import BaseService from "@/services/baseService";
import PostType from "@/types/post";
import ollama from 'ollama'
import { HfInference } from "@huggingface/inference";
import { QuestionChatbotResponse, OllamaGenerateRes } from "@/types/ollamaResponse";
import fbService from "@/services/fbService";
import { MessagingMessage } from "@/types/webhook/facebook/messageEventBody";
import { text } from "stream/consumers";
import huspotConversationService from "@/services/huspotConversationService";


class ChatService extends BaseService {

    private readonly elasticApiBaseUrl = process.env.NEXT_PUBLIC_ELASTIC;

    private readonly apiBaseUrl = `${process.env.NEXT_PUBLIC_API_URL}/api`;

    private readonly clientBaseUrl = process.env.NEXT_PUBLIC_CLIENT_URL;

    private readonly ollamaBaseUrl = `${process.env.NEXT_PUBLIC_OLLAMA}/api`;

    private readonly model_name = "aya:8b"

    private readonly questionPrompt = `Đầu tiên tôi muốn bạn tóm tắt câu nói mà người tìm việc muốn hỏi dựa trên những câu hỏi mới nhất trong đoạn hội thoại. Nếu câu nói của người dùng không liên quan đến lĩnh vực tìm việc làm thì bạn hãy viết 1 câu xin lỗi ngắn gọn một cách lịch sự vì không thể hỗ trợ trong lĩnh vực khác và lưu vào 'response' và 'status' bằng 0. Nếu câu nói liên quan đến lĩnh vực tìm việc làm thì bạn cần phải tóm tắt và đầy đủ mong muốn cụ thể những điều gì chằng hạn như lương, địa điểm (nếu có) và lưu vào 'response', lúc này 'status' bằng 1. Hãy chắc chắn rằng phản hồi của bạn là 1 object và không có bất kì kí tự nào khác ngoài object và không cần ý kiến của bạn. Trong object đó chứa 2 thuộc tính là 'status' và 'response'. Ví dụ: Đây là câu trả lời của bạn '{'status': 0, 'response': 'Xin lỗi nhưng tôi không trả lời câu hỏi liên quan'}' về cuộc hội thoại '['role': 'user', 'content': 'Bạn biết chơi game không']'. Bây giờ hãy tóm tắt cuộc hội thoại`



    async getMessage(pageId: string, senderPsid: string, messages: Array<any>) {

        // Prefix Question
        const rewriteQues = await this.handleQuestion(messages)
        console.log(rewriteQues.status, rewriteQues.response);
        if (!rewriteQues.status) return { text: rewriteQues.response }

        // Get Data from Vector DB
        const posts = await this.getPosts(rewriteQues.response as string)

        // Handle Response to user
        return this.handleAnswer(pageId, senderPsid, rewriteQues.response as string, posts)
    }

    async sendMessageFromAIHuspot(threadId: string, messages: Array<any>) {
        let message = {
            text: "", richText: ""
        }
        // Prefix Question
        // Backend Web Developer lương trên 5 triệu ở Khánh Hòa
        const rewriteQues = await this.handleQuestion(messages)
        console.log(rewriteQues.status, rewriteQues.response);
        if (!rewriteQues.status) {
            message.text = rewriteQues.response
            message.richText = `<div><span>${rewriteQues.response} 😥😥😥</span></div>`
        }
        else {
            // Get Data from Vector DB
            const posts = await this.getPosts(rewriteQues.response as string)

            // Handle Response to user
            if (posts.length == 0) {
                // Ask user give more information 
                message.text = `không thể tìm thấy bài đăng phù hợp với từ khóa của bạn '${rewriteQues.response}'. Bạn hãy cung cấp nhiều thông tin cụ thể hơn như sau: lương mong muốn, địa điểm, ...`, // Need to create prompt to ask user give more information
                    message.richText = `<div><span>${message.text} 😥😥😥</span></div>`
            } else {
                message.text = `Đây là top ${posts.length} bài post về từ khóa '${rewriteQues.response}'.\n ${posts.map(
                    (post, idx) => { return `${idx + 1}. ${post.title}` }
                ).join("\n")}`
                message.richText = `
                <p>Đây là top ${posts.length} bài post về từ khóa '${rewriteQues.response}'.<a href="${this.clientBaseUrl}/posts?search=${rewriteQues.response}" rel="noopener">Click để xem chi tiết</a></p>
                <ol>
                ${posts.map(post => `
                <li>
                <a href="${this.clientBaseUrl}/posts/${post.id}" rel="noopener" target="_blank" style="background-color: #ffff04;">
                    ${post.title}</a>&nbsp;<br>
                    ${post.business.name}<br>
                    ${(!/\d/.test(post.minSalaryString)) ? "Thỏa thuận" : `${post.minSalaryString} - ${post.maxSalaryString}`}<br>
                    ${post.locations.map(location => location.provinceName).join(" - ")}
                </li>`).join("\n")}
                </ol>
                `
            }
        }
        console.log(message.text);
        console.log(message.richText);

        await huspotConversationService.sendMessageFromAIByDefault({
            threadId, text: message.text, richText: message.richText
        })
    }
    async sendMessageFromAssistantHuspot(threadId: string) {
        await huspotConversationService.sendMessageFromAIByDefault({
            threadId, sender: "ASSISTANT", text: `Vui lòng đợi trong giây lát, chúng tôi sẽ trả lời ngay.`, richText: `<div>Vui lòng đợi trong giây lát, chúng tôi sẽ trả lời ngay</div>`
        })
    }


    async readAllChunks(readableStream: ReadableStream) {
        const reader = readableStream.getReader();
        const chunks = [];

        let done, value;
        while (!done) {
            ({ value, done } = await reader.read());
            if (done) {
                return chunks;
            }
            chunks.push(value);
        }
    }

    async handleQuestion(messages: Array<any>) {
        // Handle question and chat history to make an fully question.
        let prompt = `
            ${this.questionPrompt} ${JSON.stringify(messages)}
        `.trim()
        let response = await fetch(`${this.ollamaBaseUrl}/generate`, {
            method: "POST",
            body: JSON.stringify({
                model: this.model_name,
                stream: false,
                prompt: prompt
            }),
        })
        await this.checkResponseNotOk(response)
        const data = await this.getResponseData<OllamaGenerateRes>(response)
        console.log("Ollama Res: ", data.response);

        return JSON.parse(data.response.substring(data.response.indexOf("{"), data.response.indexOf("}") + 1)) as QuestionChatbotResponse
    }

    async handleAnswer(pageId: string, senderPsid: string, rewriteQues: string, posts: PostType[]) {

        if (posts.length == 0) {
            // Ask user give more information 
            return {
                text: `không thể tìm thấy bài đăng phù hợp với từ khóa của bạn '${rewriteQues}'. Bạn hãy cung cấp nhiều thông tin cụ thể hơn như sau: lương mong muốn, địa điểm, ...`, // Need to create prompt to ask user give more information
            }
        }
        const postsCard = posts.map(post => ({
            title: post.title,
            image_url: "https://cdn.sanity.io/images/mz2hls6g/production/b1e56a9c6e1e6d81177cbbc273c788795a00f3c1-6000x4002.jpg?w=828&q=75&fit=clip&auto=format" || `${this.apiBaseUrl}/businesses/${post.business.id}/profileImage`,
            subtitle: `${post.business.name} \n${`${(!/\d/.test(post.minSalaryString)) ? "Thỏa thuận" : `${post.minSalaryString} - ${post.maxSalaryString}`}`
                } \n${`${post.locations.map(location => location.provinceName).join(" - ")}`
                }`,
            buttons: [
                {
                    "type": "web_url",
                    "title": "See Detail",
                    "url": `${this.clientBaseUrl}/posts/${post.id}`,
                }
            ]
        })).slice(0, 7)// Top 7 posts. Cause it limit 15 posts

        const res = {
            attachment: {
                type: "template",
                payload: {
                    template_type: "generic",
                    elements: postsCard
                }
            }
        }
        // Send First Message to User
        await fbService.sendOnTyping(pageId, senderPsid)
        await fbService.sendMessage(senderPsid, pageId, {
            text: `Đây là Top ${postsCard.length} bài đăng về từ khóa '${rewriteQues}'. Xem chi tiết tại đây: ${this.clientBaseUrl}/posts?search=${rewriteQues}`
        })
        return res
    }

    async getPosts(postName: string) {
        // const res = await fetch(`${this.elasticApiBaseUrl}/api/post?search=${postName}`, {
        //     method: "GET",
        //     headers: {
        //         'Content-Type': 'application/json'
        //     }
        // })
        // await this.checkResponseNotOk(res)
        // return this.getResponseData(res) as PostType[]
        return [] as PostType[]
        return [
            {
                "id": "660fb32bebddec564a76ef5e",
                "title": "AI smart Test",
                "profession": {
                    "id": "65e097a4bfdb92a961c286a6",
                    "name": "Bán hàng / Kinh doanh",
                    categoryId: "65e097a4bfdb92a961c286a5"
                },
                "minSalary": 15000000,
                "minSalaryString": "15 tr",
                "maxSalary": 20000000,
                "maxSalaryString": "20 tr",
                "currency": "VND",
                "level": {
                    "id": "64cdbe0be84b6f0a08a90cee",
                    "name": "Nhân viên"
                },
                "locations": [
                    {
                        "provinceName": "Khánh Hòa",
                        "specificAddress": "Xuân Hòa 2"
                    },
                    {
                        "provinceName": "An Giang",
                        "specificAddress": "An GIang 1"
                    }
                ],
                totalViews: 0,
                "business": {
                    "id": "65ffccad48887841f8677c93",
                    "name": "Company Tech",
                    "profileImageId": "6b58410c-e154-444d-a2dd-69ee3ad6c39f"
                },
                "workingFormat": "full-time",
                "applicationDeadline": "2024-08-20",
                "createdAt": "2024-04-05"
            },
            {
                "id": "65e4a54df0456cc31efe9ae0",
                "title": "TRÌNH DƯỢC VIÊN OTC THÁI NGUYÊN - HÒA BÌNH - LÀO CAI",
                "profession": {
                    "id": "65e097a4bfdb92a961c286a6",
                    "name": "Bán hàng / Kinh doanh",
                    categoryId: "65e097a4bfdb92a961c286a5"
                },
                "minSalary": -9223372036854775808,
                "minSalaryString": "Cạnh tranh",
                "maxSalary": 9223372036854775807,
                "maxSalaryString": "Cạnh tranh",
                // "currency": null,
                "level": {
                    "id": "64cdbe0be84b6f0a08a90cee",
                    "name": "Nhân viên"
                },
                "locations": [
                    {
                        "provinceName": "Hòa Bình",
                        "specificAddress": ""
                    },
                    {
                        "provinceName": "Quận 7",
                        "specificAddress": ""
                    },
                ],
                totalViews: 0,
                "workingFormat": "Nhân viên chính thức",
                "benefits": [
                    {
                        "id": "64cc6b4c1f4068147ecf50b8",
                        "name": "Chăm sóc sức khỏe"
                    },
                    {
                        "id": "64cc6ba91f4068147ecf50bc",
                        "name": "Phụ cấp"
                    },
                    {
                        "id": "64cc6bd11f4068147ecf50be",
                        "name": "Đồng phục"
                    }
                ],
                "description": "<div class=\"detail-row reset-bullet\"> <h2 class=\"detail-title\">Mô tả Công việc</h2> <p>Do nhu cầu mở rộng sản xuất kinh doanh, công ty Cổ phần Xuất nhập khẩu Y tế DOMESCO có nhu cầu tuyển dụng như sau:</p> <p><em><u>- Nơi làm việc: </u></em>THÁI NGUYÊN - HÒA BÌNH - LÀO CAI</p> <p><em><u>- </u></em><em><u>Mức lương:</u></em> Cạnh tranh, tùy thuộc vào năng lực và hiệu quả của từng ứng viên</p> <p><em><u>- Công việc cần tuyển dụng</u></em><em><u>:</u></em> Đi định vị theo tuyến, giới thiệu sản phẩm của Công ty, Chăm sóc khách hàng, mở rộng và phát triển thị trường, tăng độ phủ khách hàng và sản phẩm, lập các kế hoạch bán hàng và các báo cáo liên quan đến công việc bán hàng.</p> </div>",
                "yearsOfExperience": "1 - 3 Năm",
                "otherRequirements": "Bằng cấp: Trung cấp</br>Độ tuổi: Không giới hạn tuổi</br>Lương: Cạnh tranh",
                "requisitionNumber": 13,
                "applicationDeadline": "2024-05-18T00:00:00",
                "jdId": null,
                "recruiterId": null,
                activeStatus: 'Opening',
                createdAt: "",
                "business": {
                    "id": "65e48a4ae9406098c28bcbf5",
                    "name": "Công ty CP Xuất Nhập Khẩu Y Tế Domesco",
                    "profileImageId": "80c51b20-18c8-4cae-a1d7-badd9080328e"
                }
            },
            {
                "id": "660fb32bebddec564a76ef5e",
                "title": "IT backend Dev",
                "profession": {
                    "id": "65e097a4bfdb92a961c286a6",
                    "name": "Bán hàng / Kinh doanh",
                    categoryId: "65e097a4bfdb92a961c286a5"
                },
                "minSalary": 15000000,
                "minSalaryString": "5 tr",
                "maxSalary": 20000000,
                "maxSalaryString": "20 tr",
                "currency": "VND",
                "level": {
                    "id": "64cdbe0be84b6f0a08a90cee",
                    "name": "Nhân viên"
                },
                "locations": [
                    {
                        "provinceName": "Bình Dương",
                        "specificAddress": "Xuân Hòa 2"
                    },
                    {
                        "provinceName": "Thủ Đức",
                        "specificAddress": "An GIang 1"
                    }
                ],
                totalViews: 0,
                "business": {
                    "id": "65ffccad48887841f8677c93",
                    "name": "Công ty TNHH An Hòa Lạc 3",
                    "profileImageId": "6b58410c-e154-444d-a2dd-69ee3ad6c39f"
                },
                "workingFormat": "full-time",
                "applicationDeadline": "2024-08-20",
                "createdAt": "2024-04-05"
            },
        ] as PostType[]
    }
}

const chatService = await new ChatService();

export default chatService