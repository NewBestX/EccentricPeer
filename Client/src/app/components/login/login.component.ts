import {Component, EventEmitter, OnInit, Output, TemplateRef, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {UIController} from '../../../logic/UIController';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  @ViewChild('loginModal', {static: true})
  loginModal: TemplateRef<any>;
  @ViewChild('registerModal', {static: true})
  registerModal: TemplateRef<any>;
  @ViewChild('changePasswordModal', {static: true})
  changePasswordModal: TemplateRef<any>;

  @Output() authFinishedEvent = new EventEmitter<string>();

  showInvalidDataAlert = false;

  constructor(private modalService: NgbModal) {
  }

  ngOnInit(): void {
    this.showLogin();
  }

  showRegister(): void {
    this.modalService.dismissAll();
    this.showInvalidDataAlert = false;
    this.modalService.open(this.registerModal, {backdrop: 'static', keyboard: false, centered: true});
  }

  showLogin(): void {
    this.modalService.dismissAll();
    this.showInvalidDataAlert = false;
    this.modalService.open(this.loginModal, {backdrop: 'static', keyboard: false, centered: true});
  }

  showChangePassword(): void {
    this.modalService.dismissAll();
    this.showInvalidDataAlert = false;
    this.modalService.open(this.changePasswordModal, {backdrop: 'static', keyboard: false, centered: true});
  }

  clickLogin(formValue): void {
    const {username, password} = formValue;
    UIController.login(username, password).then(() => {
      this.modalService.dismissAll();
      this.authFinishedEvent.emit();
    }).catch(() => {
      this.showInvalidDataAlert = true;
    });
  }

  clickRegister(formValue): void {
    const {username, password, repeatPassword} = formValue;
    if (password !== repeatPassword) {
      this.showInvalidDataAlert = true;
      return;
    }
    UIController.register(username, password).then((recoveryKey) => {
      this.modalService.dismissAll();
      this.authFinishedEvent.emit(recoveryKey);
    }).catch(() => {
      this.showInvalidDataAlert = true;
    });
  }

  clickChangePassword(formValue): void {
    const {username, password, repeatPassword, recoveryKey} = formValue;
    if (password !== repeatPassword) {
      this.showInvalidDataAlert = true;
      return;
    }
    UIController.changePassword(username, password, recoveryKey).then(() => {
      this.modalService.dismissAll();
      this.authFinishedEvent.emit();
    }).catch(() => {
      this.showInvalidDataAlert = true;
    });
  }
}
