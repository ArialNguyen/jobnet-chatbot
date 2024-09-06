import OpenAI from "openai";

// Your task is to create and return a JSON object as follows:
// {"status": 0 or 1, "content": string}
// The requirement is to analyze the conversation about the job search topic I provided and check if the user's job search question meets the following 4 standards: job name, salary, job position and location.
// If the above 4 standards are met, the status is 1 and the content is "" in the above object
// If the above 4 standards are not met, ask the user to enter the missing criteria and save this question to "content", at this time the status = 0 in the above object
// Please answer correctly in the user's language

const context_prompt = `
You are a chatbot that helps you find jobs and does not help with other issues.
Your task is to analyze the conversation about the job search topic I provided and check if the user's job search question meets the following 4 standards: job name, salary, job position and location.
If one or more of the above standards are missing, ask the user to enter the missing standards.
If all of the above standards are met, You just need to return the two words "OK" and do not add any other information.
Please answer correctly in the user's language
`

const POST = async (req: Request) => {
    const body = await new Response(req.body).json()
    const { messages: data } = body
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    })

    data.unshift({
        role: "system",
        content: context_prompt
    })
    
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: data
    })
        
    return new Response(response.choices[0].message.content, {
        status: 200
    })
}


export { POST }