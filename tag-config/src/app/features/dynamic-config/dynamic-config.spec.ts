import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DynamicConfig } from './dynamic-config';

const API_URL = 'http://localhost:3001';

describe('DynamicConfig', () => {
  let fixture: ComponentFixture<DynamicConfig>;
  let httpTesting: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DynamicConfig],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DynamicConfig);
    element = fixture.nativeElement;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('mostra os gateways recebidos da API', async () => {
    await fixture.whenStable();

    httpTesting.expectOne(`${API_URL}/plugins`).flush([
      { id: 'kong', name: 'Kong' },
      { id: '3scale', name: '3scale' },
    ]);
    await fixture.whenStable();

    const buttons = element.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Kong');
    expect(buttons[1].textContent).toContain('3scale');
  });

  it('mostra um erro quando a lista de gateways falha', async () => {
    await fixture.whenStable();

    httpTesting
      .expectOne(`${API_URL}/plugins`)
      .flush(null, { status: 500, statusText: 'Erro interno' });
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar os gateways',
    );
  });
});
