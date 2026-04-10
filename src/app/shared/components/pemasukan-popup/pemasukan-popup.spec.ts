import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PemasukanPopup } from './pemasukan-popup';

describe('PemasukanPopup', () => {
  let component: PemasukanPopup;
  let fixture: ComponentFixture<PemasukanPopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PemasukanPopup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PemasukanPopup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
