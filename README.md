# Sorgenia Dashboard Card

Scheda Lovelace community non ufficiale per mostrare in un'unica vista le bollette e i consumi Sorgenia.

## Installazione con HACS

1. In HACS apri il menu ⋮ → **Repository personalizzati**.
2. Inserisci l'URL GitHub di questo repository e scegli **Dashboard**.
3. Scarica **Sorgenia Dashboard Card**.
4. Aggiungi la scheda alla dashboard con una scheda manuale:

```yaml
type: custom:sorgenia-dashboard-card
title: Sorgenia · Luce e gas
max_bills: 10
```

La scheda usa gli entity ID predefiniti dell'integrazione Sorgenia Bills 1.2.x. Se li hai rinominati, puoi sostituirli nella sezione `entities` della configurazione. Un esempio di vista completa è in `dashboard-example.yaml`.
