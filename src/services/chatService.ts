import PipelineSingleton from "@/app/classify/pipeline";
import BaseService from "@/services/baseService";
import PostType from "@/types/post";
import { Message } from "@/types/webhook/facebook/messageEventBody";
import { TextGenerationPipeline, pipeline } from '@xenova/transformers';

class ChatService extends BaseService {

    private readonly elasticApiBaseUrl = process.env.NEXT_PUBLIC_ELASTIC;

    private readonly model_name = "CohereForAI/aya-23-35B"

    private readonly task = "text-generation"

    private readonly context = `
        Chúng ta đang ở trong cuộc hội thoại về tìm kiếm việc làm giữa người tìm việc và website đăng tuyển việc làm. 
        Nếu người tìm việc hỏi về nội dung không liên quan hãy từ chối trả lời một cách lịch sự. 
        Hãy kết hợp với lịch sử nhắn tin nếu câu hỏi của người dùng có liên quan đến tin nhắn trước đó. 
        Hãy chắc chắn rằng Bạn chỉ trả lời dưới dạng json. Trong đó có 2 thuộc tính:
        1. key là "status" - Có 2 giá trị 0 và 1. Bằng 0 nếu người tìm việc hỏi về nội dung không liên quan và ngược lại
        2. key là "message" - Là câu trả lời của bạn.
    `

    private readonly questionPromptTemplate = `
        ${this.context}
        Điều tôi muốn là bạn hãy đưa ra tên công việc mà người dùng muốn hỏi. 
        Tên công việc này phải ngắn gọn, minh bạch, dễ hiểu như tên một bài đăng trên các website tìm việc làm.
    `

    private readonly answerPromptTemplate = ""

    // private reviewer: TextGenerationPipeline | null = null
    private reviewer: TextGenerationPipeline | null = null

    // constructor(reviewer: TextGenerationPipeline) {
    //     super()
    //     return (async (): Promise<ChatService> => {
    //         this.reviewer = reviewer
    //         return this;
    //     })() as unknown as ChatService;
    // }



    async getMessage(messages: Array<any>) {

        const question = await this.handleQuestion(messages)

        // const data =  await this.getPosts(question)


        // return this.handleAnswer(messages, data)
    }

    async handleQuestion(messages: Array<any>) {
        // Handle question and chat history to make an fully question.
        let prompt = `
            ${this.context}
            ${this.questionPromptTemplate}
            ${messages}
        `
        const classifier = await pipeline(this.task, this.model_name)
        const result = await classifier(prompt);
        console.log(result);
        
    }

    handleAnswer(messages: Array<any>, data: PostType[]) {

        return `
            Here some posts for you...
            1. Backend IT https://a.com
            2. Frontend IT https://b.com
            3. DevOps IT https://c.com
        `
    }

    async getPosts(postName: string) {
        const res = await fetch(`${this.elasticApiBaseUrl}/api/post?search=${postName}`, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json'
            }
        })

        this.checkResponseNotOk(res)
        return this.getResponseData(res) as PostType[]
    }
}

const chatService = await new ChatService();
// const chatService = await new ChatService(await pipeline("text-generation", "CohereForAI/aya-23-35B"));


export default chatService