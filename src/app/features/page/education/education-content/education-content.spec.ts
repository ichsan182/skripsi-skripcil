import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EducationContent } from './education-content';

describe('EducationContent', () => {
  let component: EducationContent;
  let fixture: ComponentFixture<EducationContent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EducationContent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EducationContent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
