interface Microfrontend {
  tag: string;
  title: string;
  url: string;
}

const nav = document.querySelector<HTMLElement>('#nav')!;
const outlet = document.querySelector<HTMLElement>('#outlet')!;

function mostrarMensagem(text: string): void {
  const message = document.createElement('p');
  message.className = 'portal-message';
  message.setAttribute('role', 'alert');
  message.textContent = text;
  outlet.replaceChildren(message);
}

function carregarScript(entry: Microfrontend): Promise<void> {
  return new Promise((resolve, reject) => {
    if (customElements.get(entry.tag)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = entry.url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${entry.url}`));
    document.head.appendChild(script);
  });
}

async function abrirMicrofrontend(entry: Microfrontend, button: HTMLButtonElement): Promise<void> {
  nav.querySelectorAll('button').forEach((item) => item.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'true');

  outlet.replaceChildren(document.createElement(entry.tag));

  try {
    await carregarScript(entry);
  } catch {
    mostrarMensagem(`Não foi possível carregar "${entry.title}".`);
  }
}

async function iniciar(): Promise<void> {
  try {
    const response = await fetch('/microfrontends.json');

    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const microfrontends: Microfrontend[] = await response.json();

    for (const entry of microfrontends) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.title;
      button.addEventListener('click', () => abrirMicrofrontend(entry, button));
      nav.appendChild(button);
    }

    nav.querySelector('button')?.click();
  } catch {
    mostrarMensagem('Não foi possível carregar a lista de micro-frontends.');
  }
}

void iniciar();
