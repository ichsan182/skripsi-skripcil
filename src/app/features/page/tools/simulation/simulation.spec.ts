import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ToolsSimulation } from './simulation';

describe('Simulation', () => {
  let component: ToolsSimulation;
  let fixture: ComponentFixture<ToolsSimulation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolsSimulation],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolsSimulation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
