import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { Home } from './home';
import { JournalService } from '../core/services/journal.service';
import { RollingBudgetService } from '../core/utils/rolling-budget.service';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let httpClientSpy: jasmine.SpyObj<HttpClient>;
  let journalServiceSpy: jasmine.SpyObj<JournalService>;

  const createFinancialData = () => ({
    pendapatan: 16000000,
    pengeluaranWajib: 4800000,
    tanggalPemasukan: 1,
    intendedTanggalPemasukan: 1,
    hutangWajib: 0,
    estimasiTabungan: 10000000,
    danaDarurat: 5000000,
    danaInvestasi: 0,
    budgetAllocation: {
      mode: 2 as const,
      pengeluaran: 30,
      wants: 0,
      savings: 70,
    },
    savingsAllocation: {
      tabungan: 5000000,
      danaDarurat: 0,
      danaInvestasi: 0,
    },
    currentPengeluaranLimit: 4800000,
    currentPengeluaranUsed: 0,
    currentSisaSaldoPool: 6200000,
    currentCycleStart: '2026-04-01',
    currentCycleEnd: '2026-04-30',
    monthlyTopUp: {
      cycleKey: '2026-04-01',
      fromTabunganCount: 0,
      totalFromTabungan: 0,
      totalFromDanaDarurat: 0,
    },
  });

  beforeEach(async () => {
    httpClientSpy = jasmine.createSpyObj<HttpClient>('HttpClient', ['patch']);
    httpClientSpy.patch.and.returnValue(of({}));

    journalServiceSpy = jasmine.createSpyObj<JournalService>('JournalService', [
      'loadCurrentUserJournal',
    ]);
    journalServiceSpy.loadCurrentUserJournal.and.resolveTo({
      nextChatMessageId: 1,
      chatByDate: {},
      expensesByDate: {},
      incomesByDate: {},
    });

    localStorage.setItem(
      'currentUser',
      JSON.stringify({
        id: 'user-1',
        name: 'Test User',
        financialData: createFinancialData(),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: httpClientSpy },
        { provide: JournalService, useValue: journalServiceSpy },
        {
          provide: RollingBudgetService,
          useValue: {
            computeRollingBudgetState: () => ({
              rollingTotalBudget: 0,
              rollingUsedBudget: 0,
              rollingBudgetRemaining: 0,
              rollingDaysRemaining: 0,
              rollingBudgetToday: 0,
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves active sisa saldo when saving without new allocations', async () => {
    component.openSettingPersenan();

    expect(component.savingsTotalAmount).toBe(6200000);

    await component.saveSettingPersenan();

    expect(component.financialData?.currentSisaSaldoPool).toBe(6200000);
    expect(httpClientSpy.patch).toHaveBeenCalled();
  });

  it('only adds the delta when pendapatan changes mid-cycle', async () => {
    component.openSettingPersenan();
    component.pendapatanInput = 17000000;

    expect(component.savingsTotalAmount).toBe(6900000);

    await component.saveSettingPersenan();

    expect(component.financialData?.currentSisaSaldoPool).toBe(6900000);
    expect(component.financialData?.currentPengeluaranLimit).toBe(5100000);
  });
});
