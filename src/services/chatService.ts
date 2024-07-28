import BaseService from "@/services/baseService";
import PostType from "@/types/post";
import { QuestionChatbotResponse } from "@/types/ollamaResponse";
import fbService from "@/services/fbService";
import huspotConversationService from "@/services/huspotConversationService";

class ChatService extends BaseService {

    private readonly baseUrl = process.env.NEXT_PUBLIC_BASE_URL

    private readonly elasticApiBaseUrl = process.env.NEXT_PUBLIC_ELASTIC;

    private readonly apiBaseUrl = `${process.env.NEXT_PUBLIC_API_URL}/api`;

    private readonly clientBaseUrl = process.env.NEXT_PUBLIC_CLIENT_URL;

    private questionPrompt_gemini = `
    You are a helpful job search assistant. Please return JSON ( not JSON5 ) describing the user's question in this conversation using the following schema:
    { "normalQuestion": NORMAL, "irrelevantQuestion": IRRELEVANT, "relevant": RELEVANT}
    NORMAL = { "response": str }
    IRRELEVANT = { "response": str }
    RELEVANT = { "response": str, "numberOfList": number}
    All fields are required.
    Important: Only return a single piece of valid JSON text.

    Here is the workflow to apply data into the JSON:
    1. The first thing you need to do is summarize the user's questions from the conversation and always prioritize the latest wishes.
    2. Once you have the user's latest question, do one of the following three things if correct:
    Case 1: In this case make sure both attribute "normalQuestion" and "relevant" is null. If user ask question that are not related to job search support (such as weather, news, etc.), write an apology sentence for not being able to answer questions that are not related to job search and save to "response" of "irrelevantQuestion" field.
    Example for Case 1: User ask "Thời tiết hôm nay thế nào?" your JSON can be like {"normalQuestion": null, "irrelevantQuestion": {"response": "Xin lỗi, mình chỉ có thể hỗ trợ bạn tìm kiếm việc làm. 😔"}, "relevant": null}
    
    Case 2: In this case make sure both attribute "irrelevantQuestion" and "relevant" is null. If the user just say hello, thanks, or asks you how you are Then you will answer naturally like a job search support staff (make it longer and easy to understand) and save your reply to "response" of "normalQuestion" field. 
    Example for Case 2: User say "xin chào" your JSON can be like {"normalQuestion": {"response": "Chào bạn! 👋\n Rất vui được làm quen với bạn! 🥰\n  Tôi là chat bot có thể giúp bạn tìm việc làm nhanh chóng. \n"}, "irrelevantQuestion": null, "relevant": null}
    Another example for Case 2: User say "Cảm ơn" your JSON can be like {"normalQuestion": {"response": " Không có gì! 👋\n Rất vui được hỗ trợ bạn. 🥰\n Nếu bạn muốn tìm công việc gì hãy liên hệ với tôi😁"}, "irrelevantQuestion": null, "relevant": null}

    Case 3: In this case make sure both attribute "normalQuestion" and "irrelevantQuestion" is null. If the user question is related to the field of job search support, then you will prioritize analyzing the latest messages and analyze only the job title, desired salary, location and summarize them into a short, easy-to-understand sentence and save it to "response" of "relevant" field. The requirements in the analysis are as follows:
    The job title, location must be short and the salary range must be clear (preferably in words) with difficult-to-understand salaries such as: "không lớn hơn 10 triệu" must be clearly translated as "nhỏ hơn mười triệu", "10-20 triệu" will be "Khoảng mười đến hai mươi triệu", ... In addition to the phrases 'không lớn hơn' -> 'nhỏ hơn', 'không nhỏ hơn' -> 'lớn hơn', 'không dưới' -> 'lớn hơn', 'không vượt qua' -> 'nhỏ hơn'... you will have to understand and translate more easily in a similar way because those phrases will confuse the algorithm and this is very important to me, Make sure you do not ignore this requirement. Note that you only collect information, absolutely do not arbitrarily provide any additional information if it is not from the user.
    Also in this case, if the user ask to list how many posts (jobs) then you will save the number of listings into "numberOfList" field, otherwise set null into "numberOfList".
    Example for Case 3: User say "Tôi cần tìm công việc quản trị kinh doanh lương 15-20 triệu" your JSON can be like {"normalQuestion": null, "irrelevantQuestion": null, "relevant": {"response": "Quản trị kinh doanh lương từ mười lăm đến hai mươi triệu", "numberOfList": null}}
    Another Example for Case 3: User ask "Tìm cho tôi 5 bài đăng về ABC với mức lưng không lớn hơn 10 triệu" your JSON can be like {"normalQuestion": null, "irrelevantQuestion": null, "relevant": {"response": "ABC với mức lương nhỏ hơn mười triệu", "numberOfList": 5}}
    
    Notice: You can use the example above for each case but I want you to create new sentences in 'response' field to see the difference better. And Your answer the sam e language with user and can include some emojis for that situation (work for Case 1 and 2 execept case 3). And each separate sentence must be begin with new line (specifically adding the character '\n' at the end of each sentence).
    Here is conversation:
    {{}}
    `


    private getQuestionPrompt(messages: Array<any>) {
        return this.questionPrompt_gemini.replace("{{}}", messages.join("\n"))
    }

    async getMessage(pageId: string, senderPsid: string, messages: Array<any>) {

        // Prefix Question
        const rewriteQues = await this.handleQuestion(messages) // 0,1,2 

        if (rewriteQues.normalQuestion) return { text: rewriteQues.normalQuestion.response }
        else if (rewriteQues.irrelevantQuestion) return { text: rewriteQues.irrelevantQuestion.response }

        // Get Data from Vector DB
        const numberOfList = rewriteQues.relevant!!.numberOfList || 7

        const posts = (await this.getPosts(rewriteQues.relevant!!.response as string)).slice(0, numberOfList)

        // Handle Response to user 
        return this.handleAnswer(pageId, senderPsid, rewriteQues.relevant!!.response as string, posts)
    }

    async sendMessageFromAIHubspot(threadId: string, messages: Array<any>) {
        let message = {
            text: "", richText: ""
        }
        // Prefix Question
        const rewriteQues = await this.handleQuestion(messages)
        console.log("rewriteQues: ", rewriteQues);
        
        if (rewriteQues.irrelevantQuestion) {
            const res = rewriteQues.irrelevantQuestion.response.split("\n").map(sentence => `<p>${sentence}</p>`).join("")
            message.text = rewriteQues.irrelevantQuestion.response
            message.richText = `<div>${res}</div>`
        }
        else if (rewriteQues.normalQuestion) {
            const res = rewriteQues.normalQuestion.response.split("\n").map(sentence => `<p>${sentence}</p>`).join("")
            
            message.text = rewriteQues.normalQuestion.response
            message.richText = `<div>${res}</div>`
        }
        else {
            const numberOfList = rewriteQues.relevant!!.numberOfList || 7
            // Get Data from Vector DB
            const posts = (await this.getPosts(rewriteQues.relevant!!.response as string)).slice(0, numberOfList)

            // Handle Response to user
            if (posts.length == 0) {
                // Ask user give more information 
                message.text = `không thể tìm thấy bài đăng phù hợp với từ khóa của bạn '${rewriteQues.relevant!!.response}'. Bạn hãy cung cấp nhiều thông tin cụ thể hơn như sau: lương mong muốn, địa điểm, ...`, // Need to create prompt to ask user give more information
                    message.richText = `<div><span>${message.text} 😥😥😥</span></div>`
            } else {
                message.text = `Đây là top ${posts.length} bài post về từ khóa '${rewriteQues.relevant!!.response}'.\n ${posts.map(
                    (post, idx) => { return `${idx + 1}. ${post.title}` }
                ).join("\n")}`
                message.richText = `
                <p>Đây là top ${posts.length} bài post về từ khóa '${rewriteQues.relevant!!.response}'.<a href="${this.clientBaseUrl}/posts?search=${rewriteQues.relevant!!.response}" rel="noopener">Click để xem chi tiết</a></p>
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

        await huspotConversationService.sendMessageFromAIByDefault({
            threadId, text: message.text, richText: message.richText
        })
    }
    async sendMessageFromAssistantHuspot(threadId: string) {
        await huspotConversationService.sendMessageFromAIByDefault({
            threadId, sender: "ASSISTANT", text: `Vui lòng đợi trong giây lát, chúng tôi sẽ trả lời ngay.`, richText: `<div>Vui lòng đợi trong giây lát, chúng tôi sẽ trả lời ngay 👋🥰👋</div>`
        })
    }

    async handleQuestion(messages: Array<any>) {
        let prompt = this.getQuestionPrompt(messages).trim()

        let responseObj = {} as QuestionChatbotResponse
        let response = await fetch(`${this.baseUrl}/api`, {
            method: "POST",
            body: JSON.stringify({
                prompt
            }),
        })
        this.checkResponseNotOk(response)
        try {
            responseObj = await this.getResponseData<QuestionChatbotResponse>(response)
        } catch (error) {
            throw new Error("WRONG_FORMAT_OLLAMA_RESPONE")
        }
        return responseObj
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
        }))

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
        const res = await fetch(`${this.elasticApiBaseUrl}/api/post?search=${postName}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json'
            }
        })
        await this.checkResponseNotOk(res)
        return this.getResponseData(res) as PostType[]
        // return [] as PostType[]
        // return [
        //     {
        //         "id": "660fb32bebddec564a76ef5e",
        //         "title": "AI smart Test",
        //         "profession": {
        //             "id": "65e097a4bfdb92a961c286a6",
        //             "name": "Bán hàng / Kinh doanh",
        //             categoryId: "65e097a4bfdb92a961c286a5"
        //         },
        //         "minSalary": 15000000,
        //         "minSalaryString": "15 tr",
        //         "maxSalary": 20000000,
        //         "maxSalaryString": "20 tr",
        //         "currency": "VND",
        //         "level": {
        //             "id": "64cdbe0be84b6f0a08a90cee",
        //             "name": "Nhân viên"
        //         },
        //         "locations": [
        //             {
        //                 "provinceName": "Khánh Hòa",
        //                 "specificAddress": "Xuân Hòa 2"
        //             },
        //             {
        //                 "provinceName": "An Giang",
        //                 "specificAddress": "An GIang 1"
        //             }
        //         ],
        //         totalViews: 0,
        //         "business": {
        //             "id": "65ffccad48887841f8677c93",
        //             "name": "Company Tech",
        //             "profileImageId": "6b58410c-e154-444d-a2dd-69ee3ad6c39f"
        //         },
        //         "workingFormat": "full-time",
        //         "applicationDeadline": "2024-08-20",
        //         "createdAt": "2024-04-05"
        //     },
        //     {
        //         "id": "65e4a54df0456cc31efe9ae0",
        //         "title": "TRÌNH DƯỢC VIÊN OTC THÁI NGUYÊN - HÒA BÌNH - LÀO CAI",
        //         "profession": {
        //             "id": "65e097a4bfdb92a961c286a6",
        //             "name": "Bán hàng / Kinh doanh",
        //             categoryId: "65e097a4bfdb92a961c286a5"
        //         },
        //         "minSalary": -9223372036854775808,
        //         "minSalaryString": "Cạnh tranh",
        //         "maxSalary": 9223372036854775807,
        //         "maxSalaryString": "Cạnh tranh",
        //         // "currency": null,
        //         "level": {
        //             "id": "64cdbe0be84b6f0a08a90cee",
        //             "name": "Nhân viên"
        //         },
        //         "locations": [
        //             {
        //                 "provinceName": "Hòa Bình",
        //                 "specificAddress": ""
        //             },
        //             {
        //                 "provinceName": "Quận 7",
        //                 "specificAddress": ""
        //             },
        //         ],
        //         totalViews: 0,
        //         "workingFormat": "Nhân viên chính thức",
        //         "benefits": [
        //             {
        //                 "id": "64cc6b4c1f4068147ecf50b8",
        //                 "name": "Chăm sóc sức khỏe"
        //             },
        //             {
        //                 "id": "64cc6ba91f4068147ecf50bc",
        //                 "name": "Phụ cấp"
        //             },
        //             {
        //                 "id": "64cc6bd11f4068147ecf50be",
        //                 "name": "Đồng phục"
        //             }
        //         ],
        //         "description": "<div class=\"detail-row reset-bullet\"> <h2 class=\"detail-title\">Mô tả Công việc</h2> <p>Do nhu cầu mở rộng sản xuất kinh doanh, công ty Cổ phần Xuất nhập khẩu Y tế DOMESCO có nhu cầu tuyển dụng như sau:</p> <p><em><u>- Nơi làm việc: </u></em>THÁI NGUYÊN - HÒA BÌNH - LÀO CAI</p> <p><em><u>- </u></em><em><u>Mức lương:</u></em> Cạnh tranh, tùy thuộc vào năng lực và hiệu quả của từng ứng viên</p> <p><em><u>- Công việc cần tuyển dụng</u></em><em><u>:</u></em> Đi định vị theo tuyến, giới thiệu sản phẩm của Công ty, Chăm sóc khách hàng, mở rộng và phát triển thị trường, tăng độ phủ khách hàng và sản phẩm, lập các kế hoạch bán hàng và các báo cáo liên quan đến công việc bán hàng.</p> </div>",
        //         "yearsOfExperience": "1 - 3 Năm",
        //         "otherRequirements": "Bằng cấp: Trung cấp</br>Độ tuổi: Không giới hạn tuổi</br>Lương: Cạnh tranh",
        //         "requisitionNumber": 13,
        //         "applicationDeadline": "2024-05-18T00:00:00",
        //         "jdId": null,
        //         "recruiterId": null,
        //         activeStatus: 'Opening',
        //         createdAt: "",
        //         "business": {
        //             "id": "65e48a4ae9406098c28bcbf5",
        //             "name": "Công ty CP Xuất Nhập Khẩu Y Tế Domesco",
        //             "profileImageId": "80c51b20-18c8-4cae-a1d7-badd9080328e"
        //         }
        //     },
        //     {
        //         "id": "660fb32bebddec564a76ef5e",
        //         "title": "IT backend Dev",
        //         "profession": {
        //             "id": "65e097a4bfdb92a961c286a6",
        //             "name": "Bán hàng / Kinh doanh",
        //             categoryId: "65e097a4bfdb92a961c286a5"
        //         },
        //         "minSalary": 15000000,
        //         "minSalaryString": "5 tr",
        //         "maxSalary": 20000000,
        //         "maxSalaryString": "20 tr",
        //         "currency": "VND",
        //         "level": {
        //             "id": "64cdbe0be84b6f0a08a90cee",
        //             "name": "Nhân viên"
        //         },
        //         "locations": [
        //             {
        //                 "provinceName": "Bình Dương",
        //                 "specificAddress": "Xuân Hòa 2"
        //             },
        //             {
        //                 "provinceName": "Thủ Đức",
        //                 "specificAddress": "An GIang 1"
        //             }
        //         ],
        //         totalViews: 0,
        //         "business": {
        //             "id": "65ffccad48887841f8677c93",
        //             "name": "Công ty TNHH An Hòa Lạc 3",
        //             "profileImageId": "6b58410c-e154-444d-a2dd-69ee3ad6c39f"
        //         },
        //         "workingFormat": "full-time",
        //         "applicationDeadline": "2024-08-20",
        //         "createdAt": "2024-04-05"
        //     },
        // ] as PostType[]
    }
}

const chatService = await new ChatService();

export default chatService