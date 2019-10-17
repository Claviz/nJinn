export interface Webhook {
    url: string;
    headers: {
        [key: string]: string;
    }
}