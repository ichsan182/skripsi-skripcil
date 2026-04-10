import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PengeluaranPopup } from './pengeluaran-popup';

describe('PengeluaranPopup', () => {
  let component: PengeluaranPopup;
  let fixture: ComponentFixture<PengeluaranPopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PengeluaranPopup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PengeluaranPopup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
