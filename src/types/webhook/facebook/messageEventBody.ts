export default interface MessageEventBody {
    object: string;
    entry: Array<Entry>;
}

export interface Entry {
    id: string;
    time: number;
    messaging: Array<Messaging>;
}

export interface Messaging {
    sender: { id: string };
    recipient: { id: string };
    timestamp: number;
    message: MessagingMessage;
    postback: any
}

export interface MessagingMessage {
    mid?: string;
    text?: string;
    attachments?: any
    nlp?: object;
}

export interface Message {
    role: string;
    content: string;
}

export interface PostBack {
    title: string,
    payload: string
    mid: string
}


// Response to facebook

