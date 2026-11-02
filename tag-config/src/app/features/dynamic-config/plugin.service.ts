import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable, map } from "rxjs";

import { Plugin, PluginAttribute, PluginAttributesResponse } from "./plugin.model";

const API_URL = 'http://localhost:3001';

@Injectable({providedIn: 'root'})

export class PluginService {
    private readonly http = inject(HttpClient);

    getPlugins(): Observable<Plugin[]> {
        return this.http.get<Plugin[]>(`${API_URL}/plugins`)
    }

    getAttributes(pluginId: string): Observable<PluginAttribute[]> {
        return this.http.get<PluginAttributesResponse>(`${API_URL}/plugins/${encodeURIComponent(pluginId)}/attributes`)
        .pipe(map((response) => response.attributes));
    } 
    
}
