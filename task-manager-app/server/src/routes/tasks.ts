import { Router } from 'express';
import { TasksController } from '../controllers/tasksController';
import { authMiddleware } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();
const tasksController = new TasksController();

// All routes require authentication
router.use(authMiddleware);

// Task routes
router.get('/', (req, res) => tasksController.getTasks(req, res));
router.post('/', (req, res) => tasksController.createTask(req, res));
router.put('/:id', (req, res) => tasksController.updateTask(req, res));
router.delete('/:id', (req, res) => tasksController.deleteTask(req, res));

// Task acceptance workflow
router.post('/:id/accept', (req, res) => tasksController.acceptTask(req, res));
router.post('/:id/pause', (req, res) => tasksController.pauseTask(req, res));
router.post('/:id/resume', (req, res) => tasksController.resumeTask(req, res));
router.post('/:id/postpone', (req, res) => tasksController.postponeTask(req, res));
router.post('/:id/reset-suspended', (req, res) => tasksController.resetTaskToSuspended(req, res));

// Task management
router.post('/move-overdue', (req, res) => tasksController.moveOverdueTasks(req, res));

// Task notes routes
router.post('/:id/notes', (req, res) => tasksController.addNote(req, res));
router.get('/:id/notes', (req, res) => tasksController.getNotes(req, res));

/**
 * POST /api/tasks/:id/mark-printed
 * Marca un task "Ordine interno" come stampato. Gli operatori possono farlo
 * una sola volta (errore 409 se gi\u00e0 stampato). Gli admin possono ristampare
 * sempre (riaggiornano comunque internalOrderPrintedAt).
 */
router.post('/:id/mark-printed', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const user = req.user;
    if (!id) return res.status(400).json({ error: 'id mancante' });
    const rows: any[] = await prisma.$queryRawUnsafe(
      'SELECT id, internalOrderPrintedAt, internalOrderPrintedById FROM Task WHERE id = ? LIMIT 1', id
    );
    if (!rows.length) return res.status(404).json({ error: 'task non trovato' });
    const isAdmin = user?.role === 'master' || user?.role === 'ADMIN';
    const already = rows[0].internalOrderPrintedAt;
    if (already && !isAdmin) {
      return res.status(409).json({
        error: 'gi\u00e0 stampato',
        printedAt: already,
        printedById: rows[0].internalOrderPrintedById
      });
    }
    const now = new Date();
    await prisma.$executeRawUnsafe(
      'UPDATE Task SET internalOrderPrintedAt = ?, internalOrderPrintedById = ? WHERE id = ?',
      now, user?.id || null, id
    );
    res.json({ ok: true, printedAt: now, printedById: user?.id || null });
  } catch (e: any) {
    console.error('[tasks/mark-printed] errore', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/tasks/internal-order
 * Endpoint dedicato per creare un task "Ordine interno" da Avvisi.
 * Qualunque utente autenticato pu\u00f2 chiamarlo (anche operatori dall'app Android).
 * Body: { articleId, title, description?, scheduledAt?, assignedOperatorId?, priority?, estimatedMinutes? }
 */
router.post('/internal-order', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'non autenticato' });
    const {
      articleId, title, description,
      scheduledAt, assignedOperatorId,
      priority, estimatedMinutes
    } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title mancante' });

    // Trova un master a cui attribuire la creazione (createdById deve esistere)
    let createdById = user.id;
    const master = await prisma.user.findFirst({ where: { role: 'master' } });
    if (master && user.role !== 'master') createdById = master.id;

    const created = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority: priority || 'NORMAL',
        estimatedMinutes: estimatedMinutes ? Number(estimatedMinutes) : 30,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdById,
        assignedOperatorId: assignedOperatorId ? Number(assignedOperatorId) : null,
      } as any
    });

    // Snooze: l'avviso resta in lista ma non incide sul contatore campanella
    if (articleId) {
      try {
        const inv = await prisma.inventory.findFirst({
          where: { articleId: Number(articleId) },
          include: { article: { include: { shelfEntries: true } } }
        });
        if (inv) {
          const shelfTotal = ((inv as any).article?.shelfEntries || [])
            .reduce((s: number, e: any) => s + (e.quantity || 0), 0);
          await prisma.$executeRawUnsafe(
            'UPDATE Inventory SET snoozedAt = ?, snoozedAtStock = ? WHERE id = ?',
            new Date(), shelfTotal, inv.id
          );
        }
      } catch (e) { console.warn('[internal-order] snooze fallito', e); }
    }

    res.json({ ok: true, taskId: created.id });
  } catch (e: any) {
    console.error('[tasks/internal-order] errore', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/tasks/:id/complete-internal-order
 * Completa un task "Ordine interno" registrando il carico merce sullo scaffale.
 * Body: { quantity, positionCode, batch?, expiry?, notes? }
 * - Aggiunge la quantità (in colli) alla ShelfEntry esistente con stesso
 *   articolo+posizione+lotto; altrimenti crea una nuova entry.
 * - Rimuove lo snooze sull'Inventory (la merce è arrivata).
 * - Marca il task come completato.
 */
router.post('/:id/complete-internal-order', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'non autenticato' });
    const taskId = Number(req.params.id);
    if (!taskId) return res.status(400).json({ error: 'id mancante' });
    const { quantity, positionCode, batch, expiry, notes } = req.body || {};
    const qty = Number(quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: 'quantità non valida' });
    const pos = String(positionCode || '').trim();
    if (!pos) return res.status(400).json({ error: 'posizione scaffale mancante' });

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'task non trovato' });
    if ((task as any).completed) {
      return res.status(409).json({ error: 'task già completato' });
    }
    if (!/ordine interno/i.test(task.title || '')) {
      return res.status(400).json({ error: 'non è un ordine interno' });
    }

    // Estrai codice articolo dalla descrizione
    const m = (task.description || '').match(/Codice:\s*(\S+)/i);
    if (!m) return res.status(400).json({ error: 'codice articolo non trovato nel task' });
    const articleCode = m[1];
    const article = await prisma.article.findFirst({ where: { code: articleCode } });
    if (!article) return res.status(404).json({ error: `articolo con codice ${articleCode} non trovato` });

    // Verifica che la posizione esista (avviso non bloccante)
    const posExists = await prisma.shelfPosition.findFirst({ where: { code: pos } });
    if (!posExists) {
      // Creala al volo (così non blocchiamo il flusso operatore)
      try {
        await prisma.shelfPosition.create({ data: { code: pos } as any });
      } catch (_) { /* ignore */ }
    }

    // Aggiungi (o somma) alla ShelfEntry
    const batchVal = batch && String(batch).trim() ? String(batch).trim() : null;
    const expVal = expiry && String(expiry).trim() ? String(expiry).trim() : null;
    const notesVal = notes && String(notes).trim() ? String(notes).trim() : null;
    const existing = await prisma.shelfEntry.findFirst({
      where: { articleId: article.id, positionCode: pos, batch: batchVal }
    });
    if (existing) {
      await prisma.shelfEntry.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + qty,
          expiry: expVal || existing.expiry,
          notes: notesVal || existing.notes
        }
      });
    } else {
      await prisma.shelfEntry.create({
        data: {
          articleId: article.id,
          positionCode: pos,
          batch: batchVal,
          expiry: expVal,
          quantity: qty,
          notes: notesVal
        } as any
      });
    }

    // Rimuovi snooze (merce arrivata)
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE Inventory SET snoozedAt = NULL, snoozedAtStock = NULL WHERE articleId = ?',
        article.id
      );
    } catch (e) { console.warn('[complete-internal-order] unsnooze fallito', e); }

    // Marca task completato + appendi nota di carico alla descrizione
    const stamp = new Date().toLocaleString('it-IT');
    const carico =
      `\n\n--- CARICO ${stamp} (${user.username || user.id}) ---\n` +
      `Caricati: ${qty} colli in ${pos}` +
      (batchVal ? ` · Lotto: ${batchVal}` : '') +
      (expVal ? ` · Scadenza: ${expVal}` : '') +
      (notesVal ? `\nNote carico: ${notesVal}` : '');
    const newDescription = (task.description || '') + carico;
    const updated = await prisma.task.update({
      where: { id: taskId },
      data: {
        completed: true,
        completedAt: new Date(),
        completedById: user.id || null,
        paused: false,
        description: newDescription
      } as any
    });

    res.json({
      ok: true,
      task: updated,
      articleId: article.id,
      addedQuantity: qty,
      positionCode: pos
    });
  } catch (e: any) {
    console.error('[tasks/complete-internal-order] errore', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;