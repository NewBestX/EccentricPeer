import {Component, Input, OnInit} from '@angular/core';
import {PostType} from '../../../logic/model/Post';
import {UIController} from '../../../logic/UIController';
import {Observable, Subscription} from 'rxjs';

@Component({
  selector: 'app-post-list',
  templateUrl: './post-list.component.html',
  styleUrls: ['./post-list.component.css']
})
export class PostListComponent implements OnInit {
  posts: any[];
  isOwnProfile: boolean;
  isBlocked: boolean;
  youAreBlocked: boolean;
  private eventsSubscription: Subscription;
  @Input() events: Observable<void>;

  constructor() {
  }

  ngOnInit(): void {
    this.eventsSubscription = this.events.subscribe(() => this.loadData());
    this.loadData();
  }

  loadData(): void {
    this.isOwnProfile = UIController.isOwnProfile();
    this.isBlocked = UIController.isBlocked();
    this.youAreBlocked = UIController.youAreBlocked();
    this.posts = UIController.getCurrentPosts().filter(p => !p.deleted && p.postType === PostType.CONTENT)
      .sort((a, b) => b.id - a.id)
      .map(p => {
        return {
          id: p.id,
          content: {text: p.content.text, location: p.content.location},
          postType: p.postType,
          stringTime: timeDifference(p.content.timestamp)
        };
      });
  }

  clickDeletePost(postId: number): void {
    UIController.deletePost(postId).then(() => {
      this.loadData();
    }).catch(() => {
    });
  }
}

const timeDifference = (timestamp) => {
  const msPerMinute = 60 * 1000;
  const msPerHour = msPerMinute * 60;
  const msPerDay = msPerHour * 24;
  const msPerMonth = msPerDay * 30;
  const msPerYear = msPerDay * 365;

  const elapsed = Date.now() - timestamp;

  if (elapsed < msPerMinute) {
    return Math.round(elapsed / 1000) + ' seconds ago';
  } else if (elapsed < msPerHour) {
    return Math.round(elapsed / msPerMinute) + ' minutes ago';
  } else if (elapsed < msPerDay) {
    return Math.round(elapsed / msPerHour) + ' hours ago';
  } else if (elapsed < msPerMonth) {
    return Math.round(elapsed / msPerDay) + ' days ago';
  } else if (elapsed < msPerYear) {
    return Math.round(elapsed / msPerMonth) + ' months ago';
  } else {
    return Math.round(elapsed / msPerYear) + ' years ago';
  }
};
