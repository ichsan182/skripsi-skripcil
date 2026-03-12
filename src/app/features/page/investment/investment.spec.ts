import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Investment } from './investment';

describe('Investment', () => {
  let component: Investment;
  let fixture: ComponentFixture<Investment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Investment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Investment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
