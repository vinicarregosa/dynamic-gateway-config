import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';

import { Plugin, PluginAttribute } from './plugin.model';
import { PluginService } from './plugin.service';

type LoadStatus = 'aguardando' | 'carregando' | 'pronto' | 'erro';

@Component({
  selector: 'app-dynamic-config',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './dynamic-config.html',
  styleUrl: './dynamic-config.css',
})
export class DynamicConfig {
  private readonly pluginService = inject(PluginService);
  private readonly pluginSelection = new Subject<Plugin>();

  protected readonly plugins = signal<Plugin[]>([]);
  protected readonly pluginStatus = signal<LoadStatus>('carregando');
  protected readonly selectedPlugin = signal<Plugin | null>(null);

  protected readonly attributes = signal<PluginAttribute[]>([]);
  protected readonly attributeStatus = signal<LoadStatus>('aguardando');
  protected readonly form = signal(new FormRecord<FormControl<string>>({}));

  constructor() {
    this.pluginService
      .getPlugins()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (plugins) => {
          this.plugins.set(plugins);
          this.pluginStatus.set('pronto');
        },
        error: () => this.pluginStatus.set('erro'),
      });

    this.pluginSelection
      .pipe(
        tap((plugin) => {
          this.selectedPlugin.set(plugin);
          this.attributes.set([]);
          this.attributeStatus.set('carregando');
        }),
        switchMap((plugin) =>
          this.pluginService.getAttributes(plugin.id).pipe(
            catchError(() => {
              this.attributeStatus.set('erro');
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((attributes) => {
        this.form.set(this.buildForm(attributes));
        this.attributes.set(attributes);
        this.attributeStatus.set('pronto');
      });
  }

  protected selectPlugin(plugin: Plugin): void {
    const isSamePlugin = plugin.id === this.selectedPlugin()?.id;

    if (isSamePlugin && this.attributeStatus() !== 'erro') {
      return;
    }

    this.pluginSelection.next(plugin);
  }

  private buildForm(attributes: PluginAttribute[]): FormRecord<FormControl<string>> {
    const form = new FormRecord<FormControl<string>>({});

    for (const attribute of attributes) {
      form.addControl(attribute.name, new FormControl(attribute.default, { nonNullable: true }));
    }

    return form;
  }
}
