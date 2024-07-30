export interface QuestionChatbotResponse {
    normalQuestion: {
        response: string
    } |  null,
    irrelevantQuestion: {
        response: string
    } |  null,
    relevant: {
        response: string,
        minSalary: number,
        maxSalary: number
        numberOfList: number
        professions: string
    } |  null,
}