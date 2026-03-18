import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolsCalculator } from './calculator';

describe('ToolsCalculator', () => {
  let component: ToolsCalculator;
  let fixture: ComponentFixture<ToolsCalculator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolsCalculator],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolsCalculator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
