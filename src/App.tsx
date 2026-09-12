import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Clock3, LoaderCircle, MapPin, RefreshCw, ShoppingBag, TrendingUp, Utensils } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isConfigured, supabase } from "./lib/supabase";
import type { Sale } from "./types";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "Europe/Prague" });
const dateTime = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague" });
const pragueDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Prague" });
const colors = ["#0d7651", "#ec6942", "#ebb64b", "#4575c4", "#8c62b6"];

function App() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("Все точки");
  const [platform, setPlatform] = useState("Все площадки");

  const load = useCallback(async () => {
    if (!isConfigured) { setLoading(false); return; }
    setError(null);
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error: queryError } = await supabase.from("sales_snapshot").select("*").gte("ordered_at", from).order("ordered_at", { ascending: false }).limit(10000);
    if (queryError) setError("Не удалось загрузить данные");
    else setSales((data as Sale[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sync = async () => {
    setSyncing(true); setError(null);
    const { error: syncError } = await supabase.functions.invoke("sync-choice", { body: {} });
    if (syncError) setError("Обновление не удалось. Попробуйте ещё раз.");
    else await load();
    setSyncing(false);
  };

  const branches = useMemo(() => [...new Set(sales.map(s => s.branch_name))].sort(), [sales]);
  const platforms = useMemo(() => [...new Set(sales.map(s => s.platform))].sort(), [sales]);
  const filtered = useMemo(() => sales.filter(s => (branch === "Все точки" || s.branch_name === branch) && (platform === "Все площадки" || s.platform === platform)), [sales, branch, platform]);
  const total = filtered.reduce((sum, s) => sum + Number(s.total), 0);
  const avg = filtered.length ? total / filtered.length : 0;
  const itemCount = filtered.reduce((sum, s) => sum + s.item_count, 0);

  const daily = useMemo(() => {
    const days = new Map<string, { date: string; value: number }>();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000);
      days.set(pragueDay.format(date), { date: shortDate.format(date), value: 0 });
    }
    filtered.forEach(s => {
      const key = pragueDay.format(new Date(s.ordered_at));
      const day = days.get(key);
      if (day) day.value += Number(s.total);
    });
    return [...days.values()];
  }, [filtered]);

  const platformStats = useMemo(() => platforms.map((name, index) => {
    const rows = filtered.filter(s => s.platform === name);
    return { name, orders: rows.length, total: rows.reduce((sum, s) => sum + Number(s.total), 0), color: colors[index % colors.length] };
  }).filter(s => s.orders > 0), [filtered, platforms]);

  const branchStats = useMemo(() => branches.map(name => {
    const rows = filtered.filter(s => s.branch_name === name);
    return { name, orders: rows.length, total: rows.reduce((sum, s) => sum + Number(s.total), 0) };
  }).filter(s => s.orders > 0).sort((a, b) => b.total - a.total), [filtered, branches]);

  const dishes = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(s => s.items?.forEach(item => counts.set(item.name, (counts.get(item.name) ?? 0) + (item.quantity || 1))));
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [filtered]);

  return <div className="app">
    <header><div className="brand"><span className="brand-mark">M</span><div><strong>MATOKA</strong><small>Продажи · Прага</small></div></div><button className="sync" onClick={sync} disabled={syncing || !isConfigured}>{syncing ? <LoaderCircle className="spin" /> : <RefreshCw />}<span>Обновить сейчас</span></button></header>
    <main>
      <section className="intro"><div><p className="eyebrow">Операционный обзор</p><h1>Продажи за 30 дней</h1><p>Все 7 точек и каналы Choice QR · Europe/Prague</p></div><div className="updated"><Clock3 /> Автообновление каждый час</div></section>
      <section className="filters"><label><MapPin />Точка<select value={branch} onChange={e => setBranch(e.target.value)}><option>Все точки</option>{branches.map(x => <option key={x}>{x}</option>)}</select></label><label><ShoppingBag />Площадка<select value={platform} onChange={e => setPlatform(e.target.value)}><option>Все площадки</option>{platforms.map(x => <option key={x}>{x}</option>)}</select></label><span className="period"><CalendarDays /> Последние 30 дней</span></section>
      {error && <div className="error">{error}</div>}
      {loading ? <div className="state"><LoaderCircle className="spin" /> Загружаем данные…</div> : sales.length === 0 ? <div className="state empty"><div className="empty-icon"><TrendingUp /></div><h2>Данных пока нет, нажмите Обновить сейчас</h2><p>После синхронизации здесь появятся продажи всех точек.</p></div> : <>
        <section className="kpis"><Kpi icon={<TrendingUp />} label="Выручка" value={money.format(total)} note="за выбранный период" /><Kpi icon={<ShoppingBag />} label="Заказы" value={filtered.length.toLocaleString("ru-RU")} note="завершённых заказов" /><Kpi icon={<ArrowUpRight />} label="Средний чек" value={money.format(avg)} note="на один заказ" /><Kpi icon={<Utensils />} label="Позиций" value={itemCount.toLocaleString("ru-RU")} note="продано блюд" /></section>
        <section className="grid"><article className="panel chart"><PanelTitle title="Динамика выручки" subtitle="По дням, Kč" /><ResponsiveContainer width="100%" height={260}><AreaChart data={daily}><defs><linearGradient id="sales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d7651" stopOpacity={.28}/><stop offset="100%" stopColor="#0d7651" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e7df"/><XAxis dataKey="date" tick={{fontSize:11}} interval={5}/><YAxis tick={{fontSize:11}} tickFormatter={v => `${Math.round(v/1000)}k`} width={40}/><Tooltip formatter={v => [money.format(Number(v ?? 0)), "Выручка"]}/><Area type="monotone" dataKey="value" stroke="#0d7651" strokeWidth={3} fill="url(#sales)"/></AreaChart></ResponsiveContainer></article>
          <article className="panel"><PanelTitle title="Площадки" subtitle="Только каналы с продажами" /><div className="platform-list">{platformStats.map(p => <div className="platform-row" key={p.name}><span className="dot" style={{background:p.color}}/><div><strong>{p.name}</strong><small>{p.orders} заказов</small></div><b>{money.format(p.total)}</b></div>)}</div></article></section>
        <section className="grid bottom"><article className="panel"><PanelTitle title="Продажи по точкам" subtitle="Рейтинг по выручке" /><div className="ranking">{branchStats.map((b, i) => <div className="rank" key={b.name}><span>{i+1}</span><div><strong>{b.name}</strong><small>{b.orders} заказов</small></div><b>{money.format(b.total)}</b></div>)}</div></article><article className="panel"><PanelTitle title="Популярные блюда" subtitle="По количеству позиций" /><div className="ranking">{dishes.map((d, i) => <div className="rank" key={d.name}><span>{i+1}</span><strong>{d.name}</strong><b>{d.count} шт.</b></div>)}</div></article></section>
        <section className="panel orders"><PanelTitle title="Последние заказы" subtitle={`${filtered.length} записей за период`} /><div className="table-wrap"><table><thead><tr><th>Дата</th><th>Точка</th><th>Площадка</th><th>Позиций</th><th>Сумма</th></tr></thead><tbody>{filtered.slice(0,100).map(s => <tr key={s.order_id}><td>{dateTime.format(new Date(s.ordered_at))}</td><td>{s.branch_name}</td><td><span className="badge">{s.platform}</span></td><td>{s.item_count}</td><td className="amount">{money.format(Number(s.total))}</td></tr>)}</tbody></table></div></section>
      </>}
    </main>
  </div>;
}

function Kpi({icon,label,value,note}:{icon:React.ReactNode;label:string;value:string;note:string}) { return <article className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }
function PanelTitle({title,subtitle}:{title:string;subtitle:string}) { return <div className="panel-title"><h2>{title}</h2><p>{subtitle}</p></div>; }
export default App;
