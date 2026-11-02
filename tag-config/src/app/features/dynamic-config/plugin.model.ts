export interface Plugin {
    id: string;
    name: string;

}

export interface PluginAttribute {

    name: string;
    type: string;
    values: string[];
    default: string;
}
export interface PluginAttributesResponse {
    attributes: PluginAttribute[];
}