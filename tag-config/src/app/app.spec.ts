import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('mostra a tela de configuracao', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const shadowRoot = (fixture.nativeElement as HTMLElement).shadowRoot;
    expect(shadowRoot?.querySelector('h1')?.textContent).toContain('Configuração');

  });
});
