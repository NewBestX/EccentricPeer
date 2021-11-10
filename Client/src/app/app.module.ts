import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';

import {AppComponent} from './app.component';
import {MainProfileComponent} from './components/main-profile/main-profile.component';
import {LoginComponent} from './components/login/login.component';
import {NgbModule} from '@ng-bootstrap/ng-bootstrap';
import {FormsModule} from '@angular/forms';
import {PostListComponent} from './components/post-list/post-list.component';
import {ProfileCardComponent} from './components/profile-card/profile-card.component';
import {NewPostComponent} from './components/new-post/new-post.component';
import {EditProfileComponent} from './components/edit-profile/edit-profile.component';
import {RouterModule} from '@angular/router';
import {ImageToDataUrlModule} from 'ngx-image2dataurl';

@NgModule({
  declarations: [
    AppComponent,
    MainProfileComponent,
    LoginComponent,
    PostListComponent,
    ProfileCardComponent,
    NewPostComponent,
    EditProfileComponent
  ],
  imports: [
    BrowserModule,
    NgbModule,
    FormsModule,
    RouterModule.forRoot([], {onSameUrlNavigation: 'reload'}),
    ImageToDataUrlModule
  ],
  exports: [
    RouterModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
