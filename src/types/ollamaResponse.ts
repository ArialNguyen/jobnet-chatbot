export interface QuestionChatbotResponse {
    normalQuestion: {
        response: string
    } |  null,
    irrelevantQuestion: {
        response: string
    } |  null,
    relevant: {
        response: string,
        numberOfList: number
    } |  null,
}