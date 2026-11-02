import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PluginAttribute } from './plugin.model';
import { PluginService } from './plugin.service';

describe('PluginService', () => {
  let service: PluginService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PluginService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('busca a lista de plugins', () => {
    const plugins = [{ id: 'kong', name: 'Kong' }];
    let result: unknown;

    service.getPlugins().subscribe((response) => (result = response));

    const request = httpTesting.expectOne('http://localhost:3001/plugins');
    expect(request.request.method).toBe('GET');
    request.flush(plugins);

    expect(result).toEqual(plugins);
  });

  it('busca os atributos do plugin e devolve somente a lista', () => {
    const attributes: PluginAttribute[] = [
      { name: 'endpoint', type: 'url', values: [], default: '' },
    ];
    let result: PluginAttribute[] | undefined;

    service.getAttributes('kong').subscribe((response) => (result = response));

    const request = httpTesting.expectOne('http://localhost:3001/plugins/kong/attributes');
    expect(request.request.method).toBe('GET');
    request.flush({ attributes });

    expect(result).toEqual(attributes);
  });
});
