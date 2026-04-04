import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Debt } from './debt';

describe('Debt', () => {
  let component: Debt;
  let fixture: ComponentFixture<Debt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Debt]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Debt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
