import {ApplicationRef, ChangeDetectorRef, Component, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {UIController} from '../../../logic/UIController';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Router} from '@angular/router';
import {generateRandomRecoveryKey} from '../../../logic/encryption/Encryption';
import {Subject} from 'rxjs';
import {DataController} from '../../../logic/DataController';

@Component({
  selector: 'app-main-profile',
  templateUrl: './main-profile.component.html',
  styleUrls: ['./main-profile.component.css']
})
export class MainProfileComponent implements OnInit {
  recoveryKeySeed: string = undefined;
  isLoggedIn = false;
  isOwnProfile = false;
  isFollowed = false;
  isBlocked = false;
  clickedEditProfile = false;
  clickedNewPost = false;
  reloadEvent: Subject<void> = new Subject<void>();

  constructor(private modalService: NgbModal, private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
  }

  clickSearch(value): void {
    if (!value || !value.searchProfile || value.searchProfile === '') {
      return;
    }
    UIController.changeProfilePage(value.searchProfile).then(() => {
      this.reloadProfile();
    }).catch(() => console.log('Not found'));
  }

  clickFollow(): void {
    if (!this.isFollowed) {
      UIController.followUser().then(() => {
        this.isFollowed = UIController.isFollowed();
      }).catch(() => {
      });
    } else {
      UIController.unfollowUser().then(() => {
        this.isFollowed = UIController.isFollowed();
      }).catch(() => {
      });
    }
  }

  clickBlock(): void {
    if (!this.isBlocked) {
      UIController.blockUser().then(() => {
        this.reloadProfile();
      }).catch(() => {
      });
    } else {
      UIController.unblockUser().then(() => {
        this.reloadProfile();
      }).catch(() => {
      });
    }
  }

  clickNewPost(): void {
    this.clickedNewPost = true;
  }

  clickEditProfile(): void {
    this.clickedEditProfile = true;
  }

  clickHome(): void {
    UIController.goHome().then(() => {
      this.reloadProfile();
    });
  }

  finishedLogin(recoveryKey: string): void {
    this.isLoggedIn = true;
    this.recoveryKeySeed = recoveryKey;
    this.isOwnProfile = UIController.isOwnProfile();
  }

  closedNewPost(success: boolean): void {
    this.clickedNewPost = false;
    if (success) {
      this.reloadProfile();
    }
  }

  closedEditProfile(success: boolean): void {
    this.clickedEditProfile = false;
    if (success) {
      this.reloadProfile();
    }
  }

  reloadProfile(): void {
    if (!DataController.getMyProfile()) {
      this.isLoggedIn = false;
      return;
    }
    this.reloadEvent.next();
    this.isOwnProfile = UIController.isOwnProfile();
    this.isFollowed = UIController.isFollowed();
    this.isBlocked = UIController.isBlocked();
  }
}
