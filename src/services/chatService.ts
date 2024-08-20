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

    // private readonly categories = ['Tìm việc làm Bán hàng / Tiếp thị', 'Tìm việc làm Dịch vụ', 'Tìm việc làm Chăm sóc sức khỏe', 'Tìm việc làm Sản xuất', 'Tìm việc làm Hàng tiêu dùng', 'Tìm việc làm Máy tính / Công nghệ thông tin', 'Tìm việc làm Hành chính / Nhân sự', 'Tìm việc làm Kế toán / Tài chính', 'Tìm việc làm Truyền thông / Media', 'Tìm việc làm Xây dựng', 'Tìm việc làm Kỹ thuật', 'Tìm việc làm Giáo dục / Đào tạo', 'Tìm việc làm Khoa học', 'Tìm việc làm Khách sạn / Du lịch', 'Tìm việc làm Nhóm ngành khác']

    private readonly professions = ['Bán hàng / Kinh doanh', 'Bán lẻ / Bán sỉ', 'Tiếp thị / Marketing', 'Tiếp thị trực tuyến', 'Tư vấn', 'Vận chuyển / Giao nhận /  Kho vận', 'Lao động phổ thông', 'Dịch vụ khách hàng', 'Phi chính phủ / Phi lợi nhuận', 'An Ninh / Bảo Vệ', 'Luật / Pháp lý', 'Bưu chính viễn thông', 'Y tế / Chăm sóc sức khỏe', 'Dược phẩm', 'Thu mua / Vật tư', 'Xuất nhập khẩu', 'Sản xuất / Vận hành sản xuất', 'Đồ gỗ', 'In ấn / Xuất bản', 'An toàn lao động', 'Quản lý chất lượng (QA/QC)', 'Dệt may / Da giày / Thời trang', 'Hàng gia dụng / Chăm sóc cá nhân', 'Thực phẩm & Đồ uống', 'CNTT - Phần cứng / Mạng', 'CNTT - Phần mềm', 'Hành chính / Thư ký', 'Biên phiên dịch', 'Nhân sự', 'Bảo hiểm', 'Kế toán / Kiểm toán', 'Chứng khoán', 'Ngân hàng', 'Tài chính / Đầu tư', 'Giải trí', 'Tổ chức sự kiện', 'Truyền hình / Báo chí / Biên tập', 'Quảng cáo / Đối ngoại / Truyền Thông', 'Mỹ thuật / Nghệ thuật / Thiết kế', 'Nội ngoại thất', 'Kiến trúc', 'Xây dựng', 'Bất động sản', 'Dầu khí', 'Hóa học', 'Khoáng sản', 'Cơ khí / Ô tô / Tự động hóa', 'Môi trường', 'Điện / Điện tử / Điện lạnh', 'Bảo trì / Sửa chữa', 'Thư viện', 'Giáo dục / Đào tạo', 'Nông nghiệp', 'Thống kê', 'Chăn nuôi / Thú y', 'Thủy lợi', 'Công nghệ sinh học', 'Hàng hải', 'Công nghệ thực phẩm / Dinh dưỡng', 'Lâm Nghiệp', 'Trắc địa / Địa Chất', 'Thủy sản / Hải sản', 'Hàng không', 'Nhà hàng / Khách sạn', 'Du lịch', 'Ngành khác']

    private questionPrompt_gemini = `
    You are a helpful job search assistant. Please return JSON describing the user's question in this conversation using the following schema:
    { "normalQuestion": NORMAL, "irrelevantQuestion": IRRELEVANT, "relevant": RELEVANT}
    NORMAL = { "response": str }
    IRRELEVANT = { "response": str }
    RELEVANT = { "response": str, "minSalary": number, "maxSalary": number, "numberOfList": number, 'professions': list[str]}
    All fields are required.
    Important: Only return a single piece of valid JSON text.

    Here is the workflow to apply data into the JSON:
    1. The first thing you need to do is summarize the user's questions from the conversation and always prioritize the latest message.
    2. Once you have the user's latest question, do one of the following three things if correct:
    Case 1: In this case make sure both attribute "normalQuestion" and "relevant" is null. If user ask question that are not related to job search support (such as weather, news, etc.), write an apology sentence for not being able to answer questions that are not related to job search and save to "response" of "irrelevantQuestion" field.
    Example for Case 1: User ask "Thời tiết hôm nay thế nào?" your JSON can be like {"normalQuestion": null, "irrelevantQuestion": {"response": "Xin lỗi, mình chỉ có thể hỗ trợ bạn tìm kiếm việc làm. 😔"}, "relevant": null}
    
    Case 2: In this case make sure both attribute "irrelevantQuestion" and "relevant" is null. If the user just say hello, thanks, or asking about you Then you will answer naturally like a job search support staff (make it longer and easy to understand) and save your reply to "response" of "normalQuestion" field. 
    
    Case 3: In this case, make sure both the "normalQuestion" and "irrelevantQuestion" properties are null. If the user question is related to the field of job search support, then you will follow the workflow below:
    1. Prioritize the analysis of the latest messages and only analyze the job title, location, position and summarize them into a short, easy-to-understand sentence (please do not include salary information -- important) and save them in the "response" of the "relevant" field. The requirements in the analysis are as follows:
    The job title, location and position must be concise. Note that you only collect information, absolutely do not provide any additional information arbitrarily if that information is not from the user.
    2. I will give you a list of job professions, your task is to find the job professions that the user wants to ask in my profession list and save it to 'professions', if you don't find any suitable professions in my list then put an empty list in "professions" (Absolutely do not save professions that are not in my list in the 'professions' attribute -- Very important)
    3. If the the newest user question contains information about the salary. I need you to analyze the minimum salary and save it in 'minSalary' (if any) and analyze the largest salary and save it in 'maxSalary' (if any). If the salary not contains, both 'minSalary' and 'maxSalary' fields are null.
    4. If the user's latest question (Analyze only user questions, ignore staff answers) asks for a list of posts (jobs) then you will store the number of listings in the "numberOfList" field, otherwise enter null in "numberOfList".
    Example for Case 3: User say "Tôi cần tìm công việc kiến trúc sư lương 15-20 không nhỏ hơn 15 triệu" your JSON can be like {"normalQuestion": null, "irrelevantQuestion": null, "relevant": {"response": "kiến trúc sư", "professions": ["In ấn / Xuất bản", "Nội ngoại thất", "Mỹ thuật / Nghệ thuật / Thiết kế", "Kiến trúc", "Xây dựng"], "minSalary": 15000000, "maxSalary": null, "numberOfList": null}}
    Another Example for Case 3: User ask "Tìm cho tôi 5 bài đăng về Lập trình viên với mức lương không lớn hơn 10 triệu" your JSON can be like {"normalQuestion": null, "irrelevantQuestion": null, "relevant": {"response": "Lập trình viên", "professions": ["CNTT - Phần cứng / Mạng", "CNTT - Phần mềm", ], "minSalary": null, "maxSalary": 15000000, "numberOfList": 5}}
    
    Notice: You can use the example above for each case but I want you to create new sentences in 'response' field to see the difference better. And Your answer the sam e language with user and can include some emojis for that situation (work for Case 1 and 2 execept case 3). And each separate sentence must be begin with new line (specifically adding the character '\n' at the end of each sentence).
    Here is conversation:
    {{messages}}
    Here is job professions:
    {{professions}}
    `


    private getQuestionPrompt(messages: Array<any>, professions: Array<string>) {
        return this.questionPrompt_gemini.replace("{{messages}}", messages.join("\n")).replace("{{professions}}", JSON.stringify(professions))
    }

    async getMessage(pageId: string, senderPsid: string, messages: Array<any>) {

        // Prefix Question
        const rewriteQues = await this.handleQuestion(messages) // 0,1,2 
        console.log("rewriteQues:", rewriteQues);

        if (rewriteQues.normalQuestion) return { text: rewriteQues.normalQuestion.response }
        else if (rewriteQues.irrelevantQuestion) return { text: rewriteQues.irrelevantQuestion.response }

        // Get Data from Vector DB
        const numberOfList = rewriteQues.relevant!!.numberOfList || 7

        const minSalary = rewriteQues.relevant!!.minSalary
        const maxSalary = rewriteQues.relevant!!.maxSalary

        const professions = rewriteQues.relevant!!.professions

        const posts = (await this.getPosts(rewriteQues.relevant!!.response as string, minSalary, maxSalary, professions)).slice(0, numberOfList)

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
        else if (rewriteQues.normalQuestion && !rewriteQues.relevant) {
            const res = rewriteQues.normalQuestion.response.split("\n").map(sentence => `<p>${sentence}</p>`).join("")

            message.text = rewriteQues.normalQuestion.response
            message.richText = `<div>${res}</div>`
        }
        else {
            const numberOfList = rewriteQues.relevant!!.numberOfList || 7

            const minSalary = rewriteQues.relevant!!.minSalary
            const maxSalary = rewriteQues.relevant!!.maxSalary

            const professions = rewriteQues.relevant!!.professions
            // Get Data from Vector DB
            const posts = (await this.getPosts(rewriteQues.relevant!!.response as string, minSalary, maxSalary, professions)).slice(0, numberOfList)

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
        let prompt = this.getQuestionPrompt(messages, this.professions).trim()

        let responseObj = {} as QuestionChatbotResponse
        let response = null
        while (true) {
            // Run against if service 503 Service Unavailable
            response = await fetch(`${this.baseUrl}/api`, {
                method: "POST",
                body: JSON.stringify({
                    prompt
                }),
            })
            if (response.status == 200) {
                break
            }
            console.log("Refresh fetch gemini caused by 503");
        }
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
                text: `không thể tìm thấy bài đăng phù hợp với từ khóa của bạn '${rewriteQues}'. Bạn hãy cung cấp nhiều thông tin cụ thể hơn như sau: lương mong muốn, địa điểm, ... 😥😥`, // Need to create prompt to ask user give more information
            }
        }
        const postsCard = posts.map(post => ({
            title: post.title,
            image_url: `${this.apiBaseUrl}/businesses/${post.business.id}/profileImage`,
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
        })).slice(0, 10)

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
            text: `Đây là Top ${postsCard.length} bài đăng về từ khóa '${rewriteQues}'. Xem chi tiết tại đây: ${this.clientBaseUrl}/posts?search=${encodeURIComponent(rewriteQues)}}`
        })
        return res
    }

    async getPosts(postName: string, minSalary: number, maxSalary: number, professions: string) {

        const params = new URLSearchParams()
        params.append("search", postName)
        minSalary && params.append("minSalary", minSalary.toString())
        maxSalary && params.append("maxSalary", maxSalary.toString())
        professions && params.append("professions", professions)

        const res = await fetch(`${this.elasticApiBaseUrl}/api/post?${params.toString()}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json'
            }
        })
        await this.checkResponseNotOk(res)
        return this.getResponseData(res) as PostType[]
    }
}

const chatService = await new ChatService();

export default chatService