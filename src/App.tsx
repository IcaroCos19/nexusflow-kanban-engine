import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  GitBranch,
  Layers,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { INITIAL_TASKS } from './data/initialTasks';
import { analyzeTaskDag, wouldIntroduceCycle } from './engine/dagScheduler';
import { EngineeringTask, TaskPriority, WorkflowStage } from './types/workflow';

const STAGES: { key: WorkflowStage; label: string; badgeClass: string }[] = [
  { key: 'BACKLOG', label: 'Backlog Técnico', badgeClass: 'bg-slate-800 text-slate-300' },
  { key: 'IN_PROGRESS', label: 'Em Execução', badgeClass: 'bg-sky-500/20 text-sky-300' },
  { key: 'CODE_REVIEW', label: 'Code Review & QA', badgeClass: 'bg-amber-500/20 text-amber-300' },
  { key: 'DONE', label: 'Concluído (Prod)', badgeClass: 'bg-emerald-500/20 text-emerald-300' },
];

export function App() {
  const [past, setPast] = useState<EngineeringTask[][]>([]);
  const [tasks, setTasks] = useState<EngineeringTask[]>(INITIAL_TASKS);
  const [future, setFuture] = useState<EngineeringTask[][]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightCriticalOnly, setHighlightCriticalOnly] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskHours, setNewTaskHours] = useState(6);
  const [newTaskPrereq, setNewTaskPrereq] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const commitState = (nextTasks: EngineeringTask[]) => {
    setPast((prev) => [...prev, tasks]);
    setTasks(nextTasks);
    setFuture([]);
    setErrorBanner(null);
  };

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [tasks, ...prev]);
    setTasks(previous);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, tasks]);
    setTasks(next);
  };

  // Real-time DAG Critical Path computation
  const dagAnalysis = useMemo(() => analyzeTaskDag(tasks), [tasks]);
  const criticalSet = useMemo(
    () => new Set(dagAnalysis.criticalPathIds),
    [dagAnalysis.criticalPathIds]
  );

  const handleMoveStage = (taskId: string, nextStage: WorkflowStage) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Verify all prerequisites are DONE before moving to DONE
    if (nextStage === 'DONE') {
      const unfinishedDeps = task.dependencies
        .map((depId) => tasks.find((t) => t.id === depId))
        .filter((dep) => dep && dep.stage !== 'DONE');

      if (unfinishedDeps.length > 0) {
        const keys = unfinishedDeps.map((d) => d!.key).join(', ');
        setErrorBanner(
          `Bloqueio de Dependência DAG: A tarefa ${task.key} depende da conclusão prévia de [${keys}].`
        );
        return;
      }
    }

    commitState(
      tasks.map((t) => (t.id === taskId ? { ...t, stage: nextStage } : t))
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const nextNum = 101 + tasks.length;
    const newId = `t${tasks.length + 1}`;
    const dependencies = newTaskPrereq ? [newTaskPrereq] : [];

    if (newTaskPrereq && wouldIntroduceCycle(tasks, newId, newTaskPrereq)) {
      setErrorBanner('Operação bloqueada: A dependência selecionada criaria um ciclo no grafo (DAG).');
      return;
    }

    const created: EngineeringTask = {
      id: newId,
      key: `NEX-${nextNum}`,
      title: newTaskTitle.trim(),
      description: 'Nova especificação técnica adicionada ao grafo de execução.',
      stage: 'BACKLOG',
      priority: 'HIGH',
      estimateHours: Math.max(1, Number(newTaskHours) || 4),
      assignee: 'Ícaro Costa',
      tags: ['Engineering'],
      dependencies,
    };

    commitState([...tasks, created]);
    setNewTaskTitle('');
    setNewTaskPrereq('');
  };

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-rose-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white">
                  Nexus<span className="text-brand-500">Flow</span>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  DAG CPM Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Orquestrador Ágil com Ordenação Topológica (Kahn) e Caminho Crítico
              </p>
            </div>
          </div>

          {/* Undo / Redo & Critical Path Toggle */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleUndo}
              disabled={past.length === 0}
              title="Desfazer (Undo)"
              className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Refazer (Redo)"
              className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setHighlightCriticalOnly((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                highlightCriticalOnly
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              {highlightCriticalOnly ? 'Mostrando Caminho Crítico' : 'Destacar Caminho Crítico'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* DAG Guard Error Banner */}
        {errorBanner && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 flex items-center justify-between text-xs sm:text-sm text-rose-200"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-xs font-mono underline text-rose-300"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Critical Path Summary Bar */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Análise de Caminho Crítico (Critical Path Method - CPM)
            </div>
            <p className="text-xs text-slate-400">
              Qualquer atraso nas tarefas abaixo impacta diretamente a data de entrega da release:
            </p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {dagAnalysis.criticalPathIds.map((id, idx) => {
                const t = taskById.get(id);
                if (!t) return null;
                return (
                  <React.Fragment key={id}>
                    <span className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      {t.key} ({t.estimateHours}h)
                    </span>
                    {idx < dagAnalysis.criticalPathIds.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800">
            <div>
              <div className="text-[11px] text-slate-400">Duração Mínima do Grafo (CPM)</div>
              <div className="text-xl font-extrabold text-white font-mono">
                {dagAnalysis.totalCriticalDurationHours}h úteis
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Esforço Total da Sprint</div>
              <div className="text-xl font-extrabold text-brand-400 font-mono">
                {tasks.reduce((acc, t) => acc + t.estimateHours, 0)}h
              </div>
            </div>
          </div>
        </section>

        {/* Quick Task Creator + Search Bar */}
        <section className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <form onSubmit={handleCreateTask} className="flex flex-wrap items-center gap-2 flex-1">
            <input
              type="text"
              placeholder="Nova tarefa de engenharia..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 flex-1 min-w-[200px] focus:outline-none focus:border-brand-500"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={newTaskHours}
              onChange={(e) => setNewTaskHours(Number(e.target.value))}
              title="Estimativa em horas"
              className="w-20 px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-white"
            />
            <select
              value={newTaskPrereq}
              onChange={(e) => setNewTaskPrereq(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300"
            >
              <option value="">Sem Pré-requisito (Raiz DAG)</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  Depende de {t.key}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar ao Grafo
            </button>
          </form>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por chave, título ou responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 w-full sm:w-64 focus:outline-none focus:border-brand-500"
            />
          </div>
        </section>

        {/* 4-Column Kanban Board */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const columnTasks = tasks.filter((t) => {
              if (t.stage !== stage.key) return false;
              if (highlightCriticalOnly && !criticalSet.has(t.id)) return false;
              if (
                searchQuery.trim() !== '' &&
                !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !t.key.toLowerCase().includes(searchQuery.toLowerCase()) &&
                !t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
              ) {
                return false;
              }
              return true;
            });

            return (
              <div
                key={stage.key}
                className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-4 flex flex-col gap-3 min-h-[420px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-200">{stage.label}</span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${stage.badgeClass}`}>
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {columnTasks.map((task) => {
                    const isCritical = criticalSet.has(task.id);
                    const es = dagAnalysis.earliestStartByTask[task.id] ?? 0;
                    const ef = dagAnalysis.earliestFinishByTask[task.id] ?? task.estimateHours;

                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl p-3.5 border transition space-y-2.5 ${
                          isCritical
                            ? 'bg-slate-900/95 border-rose-500/40 shadow-sm shadow-rose-500/10'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-brand-400">
                            {task.key}
                          </span>
                          {isCritical && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              <Flame className="w-3 h-3" /> Crítico
                            </span>
                          )}
                        </div>

                        <h3 className="text-xs font-semibold text-white leading-snug">
                          {task.title}
                        </h3>

                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {task.description}
                        </p>

                        {/* Dependencies pills */}
                        {task.dependencies.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-[10px] text-slate-400">Req:</span>
                            {task.dependencies.map((depId) => {
                              const dep = taskById.get(depId);
                              if (!dep) return null;
                              const depDone = dep.stage === 'DONE';
                              return (
                                <span
                                  key={depId}
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                    depDone
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                  }`}
                                >
                                  {dep.key} {depDone ? '✓' : '⏳'}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Schedule Window & Stage Mover */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono" title="Janela CPM (Início -> Fim mais cedo)">
                            T+{es}h → T+{ef}h
                          </span>

                          <select
                            aria-label={`Mover estágio de ${task.key}`}
                            value={task.stage}
                            onChange={(e) =>
                              handleMoveStage(task.id, e.target.value as WorkflowStage)
                            }
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-brand-500"
                          >
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="border-t border-slate-900 py-5 text-center text-xs text-slate-500">
        Desenvolvido por <strong className="text-slate-300">Ícaro Costa</strong> • ICARUS Soluções
        Digitais • Motor de Grafos Acíclicos Direcionados (DAG) em TypeScript
      </footer>
    </div>
  );
}

export default App;
