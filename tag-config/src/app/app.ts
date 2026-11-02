import { Component, ViewEncapsulation } from '@angular/core';

import { DynamicConfig } from './features/dynamic-config/dynamic-config';
@Component({
  selector: 'app-root',
  imports: [DynamicConfig],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class App {}
