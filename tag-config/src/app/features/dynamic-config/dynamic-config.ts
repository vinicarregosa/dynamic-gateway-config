import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { Plugin } from './plugin.model'; 
import { PluginService } from './plugin.service'; 

type LoadStatus = 'carregando' | 'pronto' | 'erro';

@Component({
  selector: 'app-dynamic-config',
  imports: [MatListModule, MatProgressBarModule],
  templateUrl: './dynamic-config.html',
  styleUrl: './dynamic-config.scss',
})
export class DynamicConfig {

  private readonly pluginService = inject(PluginService);

  protected readonly plugins = signal<Plugin[]>([]);
  protected readonly pluginStatus = signal<LoadStatus>('carregando');
  protected readonly selectedPlugin = signal<Plugin | null>(null);

  constructor() {
    this.pluginService.getPlugins().pipe(takeUntilDestroyed())
    .subscribe({
      next: (plugins) => {
        this.plugins.set(plugins);
        this.pluginStatus.set('pronto');
      },
      error: () => this.pluginStatus.set('erro'),
    });
  }

    protected selectPlugin(plugin: Plugin): void {
      this.selectedPlugin.set(plugin);
    }
}
