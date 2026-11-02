import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';


const TAG_NAME = 'tag-config';

async function defineElement(): Promise<void> {
  if(customElements.get(TAG_NAME)) {
    return;
  }

  const app = await createApplication(appConfig);
  const element = createCustomElement(App, {injector: app.injector});
  customElements.define(TAG_NAME, element);
}

defineElement().catch((error) => console.error(error));
