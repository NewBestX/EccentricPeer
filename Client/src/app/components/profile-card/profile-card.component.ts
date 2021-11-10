import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {UIController} from '../../../logic/UIController';
import {IdUsernamePair} from '../../../logic/model/ProfileContent';
import {Observable, Subscription} from 'rxjs';

const DEFAULT_PICTURE = 'assets/user-512.png';

@Component({
  selector: 'app-profile-card',
  templateUrl: './profile-card.component.html',
  styleUrls: ['./profile-card.component.css']
})
export class ProfileCardComponent implements OnInit {
  username: string;
  picture: any;
  description: string;
  birthdayDay: number;
  birthdayMonth: number;
  birthdayYear: number;
  location: string;
  friends: IdUsernamePair[];
  blocked: IdUsernamePair[];
  private eventsSubscription: Subscription;
  @Input() events: Observable<void>;
  @Output() clickedProfileInListEvent = new EventEmitter<void>();

  constructor() {
  }

  ngOnInit(): void {
    this.eventsSubscription = this.events.subscribe(() => this.loadProfile());
    this.picture = DEFAULT_PICTURE;
    this.loadProfile();
  }

  loadProfile(): void {
    const profile = UIController.getCurrentProfile();

    if (!profile) {
      return;
    }

    this.username = profile.username;
    this.picture = !!profile.profilePicture.picture ? profile.profilePicture.picture : DEFAULT_PICTURE;
    this.description = profile.details.description;
    if (profile.details.birthday) {
      this.birthdayDay = profile.details.birthday.day;
      this.birthdayMonth = profile.details.birthday.month;
      this.birthdayYear = profile.details.birthday.year;
    } else {
      this.birthdayDay = undefined;
      this.birthdayMonth = undefined;
      this.birthdayYear = undefined;
    }
    this.location = profile.details.location;
    this.friends = profile.friends.elements;
    this.blocked = profile.blocked.elements;
  }

  profileClick(username: string): void {
    UIController.changeProfilePage(username).then(() => {
      this.clickedProfileInListEvent.emit();
    }).catch(() => {
      // Gets here if we clicked a deleted profile
      this.loadProfile();
    });
  }
}
