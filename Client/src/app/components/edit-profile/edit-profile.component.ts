import {Component, EventEmitter, OnInit, Output, TemplateRef, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {UIController} from '../../../logic/UIController';
import {ImageResult, Options} from 'ngx-image2dataurl';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.component.html',
  styleUrls: ['./edit-profile.component.css']
})
export class EditProfileComponent implements OnInit {
  @ViewChild('editProfileModal', {static: true})
  editProfileModal: TemplateRef<any>;
  @ViewChild('deleteProfileModal', {static: true})
  deleteProfileModal: TemplateRef<any>;

  @Output() closeEditModalEvent = new EventEmitter<boolean>();

  currentDescription: string;
  currentBirthdayDay: number;
  currentBirthdayMonth: number;
  currentBirthdayYear: number;
  currentLocation: string;

  pictureURL: any;
  pictureResizeOptions: Options = {
    resize: {
      maxHeight: 150,
      maxWidth: 150
    }
  };

  showError = false;
  alreadyEmitted = false;
  showDeleteAccount = false;
  showInvalidDataAlert = false;

  constructor(private modalService: NgbModal) {
  }

  ngOnInit(): void {
    const profile = UIController.getCurrentProfile();

    this.currentDescription = profile.details.description;
    if (profile.details.birthday) {
      this.currentBirthdayDay = profile.details.birthday.day;
      this.currentBirthdayMonth = profile.details.birthday.month;
      this.currentBirthdayYear = profile.details.birthday.year;
    }
    this.currentLocation = profile.details.location;

    this.pictureURL = profile.profilePicture.picture ? profile.profilePicture.picture : undefined;

    this.modalService.open(this.editProfileModal, {centered: true}).result.finally(() => {
      if (!this.alreadyEmitted && !this.showDeleteAccount) {
        this.closeEditModalEvent.emit(false);
      }
    });
  }

  clickSubmit(formValue): void {
    const {description, birthdayDay, birthdayMonth, birthdayYear, location} = formValue;
    const picture = this.pictureURL;
    UIController.updateProfile(description, birthdayDay, birthdayMonth, birthdayYear, location, picture).then(() => {
      this.alreadyEmitted = true;
      this.closeEditModalEvent.emit(true);
      this.modalService.dismissAll();
    }).catch(() => {
      this.showError = true;
    });
  }

  clickDeleteAccount(): void {
    this.showDeleteAccount = true;
    this.showInvalidDataAlert = false;
    this.modalService.dismissAll();
    this.modalService.open(this.deleteProfileModal, {centered: true}).result.finally(() => {
      if (!this.alreadyEmitted) {
        this.closeEditModalEvent.emit(false);
      }
    });
  }

  clickConfirmDelete(value): void {
    const key = value.recoveryKey;
    UIController.deleteAccount(key).then(() => {
      this.alreadyEmitted = true;
      this.closeEditModalEvent.emit(true);
      this.modalService.dismissAll();
    }).catch(() => {
      this.showInvalidDataAlert = true;
    });
  }

  onSelectFile(imageResult: ImageResult): void {
    if (!!imageResult.error) {
      return;
    }
    this.pictureURL = imageResult.resized
      && imageResult.resized.dataURL
      || imageResult.dataURL;
  }
}
