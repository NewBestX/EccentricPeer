import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';

import {UIController} from './logic/UIController';

if (environment.production) {
  enableProdMode();
}

UIController.init();
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

