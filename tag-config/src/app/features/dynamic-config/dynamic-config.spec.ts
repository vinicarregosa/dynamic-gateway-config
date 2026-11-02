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
    describe('ao selecionar um gateway', () => {
    const kongUrl = `${API_URL}/plugins/kong/attributes`;
    const threeScaleUrl = `${API_URL}/plugins/3scale/attributes`;

    const kongAttributes = [
      { name: 'endpoint', type: 'url', values: [], default: '' },
      {
        name: 'environment',
        type: 'select',
        values: ['development', 'production'],
        default: 'development',
      },
    ];
    const threeScaleAttributes = [{ name: 'adminPortal', type: 'url', values: [], default: '' }];

    const pluginButton = (index: number) =>
      element.querySelectorAll<HTMLButtonElement>('mat-action-list button')[index];

    beforeEach(async () => {
      await fixture.whenStable();
      httpTesting.expectOne(`${API_URL}/plugins`).flush([
        { id: 'kong', name: 'Kong' },
        { id: '3scale', name: '3scale' },
      ]);
      await fixture.whenStable();
    });

    it('desenha os campos a partir dos metadados', async () => {
      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({ attributes: kongAttributes });
      await fixture.whenStable();

      const labels = [...element.querySelectorAll('mat-label')].map((label) => label.textContent);
      expect(labels).toEqual(['endpoint', 'environment']);
      expect(element.querySelector('input')?.type).toBe('url');
      expect(element.querySelector('mat-select')?.textContent).toContain('development');
    });

    it('ao trocar de gateway, mostra novos campos e descarta os valores anteriores', async () => {
      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({ attributes: kongAttributes });
      await fixture.whenStable();

      const input = element.querySelector('input') as HTMLInputElement;
      input.value = 'https://kong.exemplo.local';
      input.dispatchEvent(new Event('input'));

      pluginButton(1).click();
      httpTesting.expectOne(threeScaleUrl).flush({ attributes: threeScaleAttributes });
      await fixture.whenStable();

      const labels = [...element.querySelectorAll('mat-label')].map((label) => label.textContent);
      expect(labels).toEqual(['adminPortal']);

      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({ attributes: kongAttributes });
      await fixture.whenStable();

      expect(element.querySelector('input')?.value).toBe('');
    });

    it('considera apenas a resposta do ultimo gateway selecionado', async () => {
      pluginButton(0).click();
      const kongRequest = httpTesting.expectOne(kongUrl);

      pluginButton(1).click();
      httpTesting.expectOne(threeScaleUrl).flush({ attributes: threeScaleAttributes });
      await fixture.whenStable();

      expect(kongRequest.cancelled).toBe(true);
      expect(element.querySelector('mat-label')?.textContent).toBe('adminPortal');
    });

    it('avisa sobre um tipo desconhecido e mantem os demais campos', async () => {
      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({
        attributes: [
          ...kongAttributes,
          { name: 'retries', type: 'number', values: [], default: '3' },
        ],
      });
      await fixture.whenStable();

      expect(element.querySelector('[role="alert"]')?.textContent).toContain('"number"');
      expect(element.querySelectorAll('mat-form-field').length).toBe(2);
    });

    it('permite tentar de novo depois de um erro', async () => {
      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush(null, { status: 500, statusText: 'Erro interno' });
      await fixture.whenStable();

      expect(element.querySelector('[role="alert"]')?.textContent).toContain(
        'Não foi possível carregar os atributos',
      );

      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({ attributes: kongAttributes });
      await fixture.whenStable();

      expect(element.querySelector('[role="alert"]')).toBeNull();
      expect(element.querySelectorAll('mat-form-field').length).toBe(2);
    });

    it('destaca o gateway selecionado', async () => {
      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({ attributes: kongAttributes });
      await fixture.whenStable();

      const selectedClass = 'dynamic-config__plugin--selected';
      expect(pluginButton(0).classList).toContain(selectedClass);
      expect(pluginButton(1).classList).not.toContain(selectedClass);
    });

    it('nao recarrega ao clicar de novo no mesmo gateway', async () => {
      pluginButton(0).click();
      httpTesting.expectOne(kongUrl).flush({ attributes: kongAttributes });
      await fixture.whenStable();

      pluginButton(0).click();

      httpTesting.expectNone(kongUrl);
    });
  });

});
