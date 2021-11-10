import {Component, OnInit, Output, EventEmitter, TemplateRef, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {UIController} from '../../../logic/UIController';

@Component({
  selector: 'app-new-post',
  templateUrl: './new-post.component.html',
  styleUrls: ['./new-post.component.css']
})
export class NewPostComponent implements OnInit {
  @ViewChild('newPostModal', {static: true})
  newPostModal: TemplateRef<any>;
  showError = false;
  alreadyEmitted = false;

  @Output() closePostModalEvent = new EventEmitter<boolean>();

  constructor(private modalService: NgbModal) {
  }

  ngOnInit(): void {
    this.modalService.open(this.newPostModal, {centered: true}).result.finally(() => {
      if (!this.alreadyEmitted) {
        this.closePostModalEvent.emit(false);
      }
    });
  }

  clickPost(formValue): void {
    UIController.newPost(formValue.text, formValue.location).then(() => {
      this.alreadyEmitted = true;
      this.closePostModalEvent.emit(true);
      this.modalService.dismissAll();
    }).catch(() => {
      this.showError = true;
    });
  }
}
