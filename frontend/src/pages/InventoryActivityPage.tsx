import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inventoryActivityApi } from '../api';
import type {
  InventoryActivityDetail,
  InventoryActivityFilters,
  InventoryActivityListItem,
  InventoryActivityPage,
  InventoryUpstreamActivity,
} from '../types';

interface FilterForm {
  type: string;
  success: string;
  storeId: string;
  search: string;
  from: string;
  to: string;
}

const emptyFilters: FilterForm = {
  type: '',
  success: '',
  storeId: '',
  search: '',
  from: '',
  to: '',
};

export default function InventoryActivityPage() {
  const [draft, setDraft] = useState<FilterForm>(emptyFilters);
  const [filters, setFilters] = useState<InventoryActivityFilters>({});
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const params = { ...filters, page, limit: 25 };

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<InventoryActivityPage>({
    queryKey: ['inventory-activity', params],
    queryFn: () => inventoryActivityApi.list(params),
    placeholderData: previous => previous,
    refetchInterval: 30_000,
  });

  const detailQuery = useQuery<InventoryActivityDetail>({
    queryKey: ['inventory-activity-detail', selectedId],
    queryFn: () => inventoryActivityApi.get(selectedId!),
    enabled: !!selectedId,
  });

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({
      ...(draft.type ? { type: draft.type as 'FULL' | 'DELTA' } : {}),
      ...(draft.success ? { success: draft.success as 'true' | 'false' } : {}),
      ...(draft.storeId.trim() ? { storeId: draft.storeId.trim() } : {}),
      ...(draft.search.trim() ? { search: draft.search.trim() } : {}),
      ...(draft.from ? { from: new Date(draft.from).toISOString() } : {}),
      ...(draft.to ? { to: new Date(draft.to).toISOString() } : {}),
    });
    setPage(1);
  };

  const clearFilters = () => {
    setDraft(emptyFilters);
    setFilters({});
    setPage(1);
  };

  const pagination = data?.pagination;

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/" style={{ color: '#FF6B00', textDecoration: 'none', fontSize: 14 }}>
          &larr; Projects
        </Link>
      </div>

      <div style={headerStyle}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Inventory Activity</h1>
          <p style={{ color: '#666', fontSize: 14, marginTop: 5 }}>
            Requests received from merchants and calls sent to 99Food.
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} style={ghostButton}>
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <form onSubmit={applyFilters} style={filterCard}>
        <div style={filterGrid}>
          <div>
            <label style={labelStyle}>Load type</label>
            <select value={draft.type} onChange={event => setDraft(value => ({ ...value, type: event.target.value }))} style={inputStyle}>
              <option value="">All</option>
              <option value="FULL">FULL</option>
              <option value="DELTA">DELTA</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Result</label>
            <select value={draft.success} onChange={event => setDraft(value => ({ ...value, success: event.target.value }))} style={inputStyle}>
              <option value="">All</option>
              <option value="true">Success</option>
              <option value="false">Error</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Store ID</label>
            <input value={draft.storeId} onChange={event => setDraft(value => ({ ...value, storeId: event.target.value }))} placeholder="Exact store ID" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Search</label>
            <input value={draft.search} onChange={event => setDraft(value => ({ ...value, search: event.target.value }))} placeholder="Request, task or operation" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input type="datetime-local" value={draft.from} onChange={event => setDraft(value => ({ ...value, from: event.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input type="datetime-local" value={draft.to} onChange={event => setDraft(value => ({ ...value, to: event.target.value }))} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button type="submit" style={primaryButton}>Apply filters</button>
          <button type="button" onClick={clearFilters} style={ghostButton}>Clear</button>
        </div>
      </form>

      <div style={summaryGrid}>
        <SummaryCard label="Matching requests" value={pagination?.total ?? 0} />
        <SummaryCard label="Current page" value={data?.items.length ?? 0} />
        <SummaryCard
          label="Errors on this page"
          value={data?.items.filter(item => item.success === false).length ?? 0}
          danger
        />
      </div>

      <div style={tableCard}>
        {isLoading ? (
          <div style={emptyStyle}>Loading activity...</div>
        ) : isError ? (
          <div style={{ ...emptyStyle, color: '#991b1b' }}>
            {getErrorMessage(error)}
          </div>
        ) : data?.items.length === 0 ? (
          <div style={emptyStyle}>No activity matches these filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e8e8', background: '#fafafa' }}>
                  {['Received', 'Request ID', 'Type', 'Stores', 'Records', 'Result', '99Food calls', 'Duration'].map(header => (
                    <th key={header} style={thStyle}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map(item => (
                  <ActivityRow key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 0 && (
          <div style={paginationStyle}>
            <span style={{ color: '#666', fontSize: 13 }}>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(value => Math.max(1, value - 1))}
                disabled={page <= 1 || isFetching}
                style={smallButton}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(value => Math.min(pagination.totalPages, value + 1))}
                disabled={page >= pagination.totalPages || isFetching}
                style={smallButton}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedId && (
        <ActivityDetailModal
          activity={detailQuery.data}
          loading={detailQuery.isLoading}
          error={detailQuery.error}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function ActivityRow({ item, onOpen }: { item: InventoryActivityListItem; onOpen: () => void }) {
  const failedCalls = item.upstreamCalls.filter(call => !call.success).length;

  return (
    <tr onClick={onOpen} style={{ borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
      <td style={tdStyle}>
        <div>{formatDate(item.createdAt)}</div>
        <div style={secondaryText}>{item.sourceIp ?? '-'}</div>
      </td>
      <td style={tdStyle}>
        <code style={codeStyle}>{shortId(item.id)}</code>
      </td>
      <td style={tdStyle}>
        <TypeBadge value={item.loadType} />
      </td>
      <td style={tdStyle}>
        <div style={{ maxWidth: 190, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {item.storeIds.length > 0
            ? item.storeIds.slice(0, 3).map(store => <span key={store} style={storeBadge}>{store}</span>)
            : '-'}
          {item.storeIds.length > 3 && <span style={secondaryText}>+{item.storeIds.length - 3}</span>}
        </div>
      </td>
      <td style={tdStyle}>{item.recordCount ?? '-'}</td>
      <td style={tdStyle}>
        <StatusBadge success={item.success} status={item.responseStatus} />
      </td>
      <td style={tdStyle}>
        <span>{item.upstreamCalls.length}</span>
        {failedCalls > 0 && <span style={{ color: '#c62828', marginLeft: 5 }}>({failedCalls} failed)</span>}
      </td>
      <td style={tdStyle}>{formatDuration(item.durationMs)}</td>
    </tr>
  );
}

function ActivityDetailModal({
  activity,
  loading,
  error,
  onClose,
}: {
  activity?: InventoryActivityDetail;
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  return (
    <div style={overlayStyle} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2 style={{ fontSize: 19 }}>Request detail</h2>
            {activity && <code style={{ ...codeStyle, display: 'inline-block', marginTop: 6 }}>{activity.id}</code>}
          </div>
          <button onClick={onClose} aria-label="Close" style={closeButton}>x</button>
        </div>

        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={emptyStyle}>Loading detail...</div>
          ) : error ? (
            <div style={{ ...emptyStyle, color: '#991b1b' }}>{getErrorMessage(error)}</div>
          ) : activity ? (
            <>
              <div style={detailGrid}>
                <DetailValue label="Received" value={formatDate(activity.createdAt)} />
                <DetailValue label="Type" value={activity.loadType ?? '-'} />
                <DetailValue label="Result" value={(activity.responseStatus ?? '-') + ' / ' + (activity.success ? 'Success' : 'Error')} />
                <DetailValue label="Duration" value={formatDuration(activity.durationMs)} />
                <DetailValue label="Records" value={String(activity.recordCount ?? '-')} />
                <DetailValue label="Stores" value={activity.storeIds.join(', ') || '-'} />
                <DetailValue label="Source IP" value={activity.sourceIp ?? '-'} />
                <DetailValue label="Path" value={activity.method + ' ' + activity.path} />
              </div>

              {activity.errorMessage && (
                <div style={errorBox}>{activity.errorMessage}</div>
              )}

              <SectionTitle>Incoming request and middleware response</SectionTitle>
              <div style={jsonGrid}>
                <JsonBlock label="Request headers" value={activity.requestHeaders} />
                <JsonBlock label="Request body" value={activity.requestBody ?? activity.requestRawBody} />
                <JsonBlock label="Response headers" value={activity.responseHeaders} />
                <JsonBlock label="Response body" value={activity.responseBody ?? activity.responseRawBody} />
              </div>

              <SectionTitle>99Food calls ({activity.upstreamCalls.length})</SectionTitle>
              {activity.upstreamCalls.length === 0 ? (
                <div style={{ color: '#888', fontSize: 13 }}>No upstream call was made.</div>
              ) : activity.upstreamCalls.map(call => (
                <UpstreamCall key={call.id ?? call.sequence} call={call} />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UpstreamCall({ call }: { call: InventoryUpstreamActivity }) {
  return (
    <div style={{ border: '1px solid #e5e5e5', borderRadius: 9, marginBottom: 12, overflow: 'hidden' }}>
      <div style={callHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={sequenceBadge}>{call.sequence}</span>
          <strong>{operationName(call.operation)}</strong>
          {call.storeId && <span style={storeBadge}>Store {call.storeId}</span>}
          {call.taskId && <code style={codeStyle}>Task {call.taskId}</code>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusBadge success={call.success} status={call.responseStatus} />
          <span style={secondaryText}>{formatDuration(call.durationMs)}</span>
        </div>
      </div>
      <div style={{ padding: 12 }}>
        {call.url && (
          <div style={{ fontSize: 12, marginBottom: 10, wordBreak: 'break-all' }}>
            <b>{call.method}</b> <code>{call.url}</code>
          </div>
        )}
        {call.errorMessage && <div style={{ ...errorBox, marginBottom: 10 }}>{call.errorMessage}</div>}
        <div style={jsonGrid}>
          <JsonBlock label="Sent headers" value={call.requestHeaders} />
          <JsonBlock label="Sent body" value={call.requestBody} />
          <JsonBlock label="Response headers" value={call.responseHeaders} />
          <JsonBlock label="Response body" value={call.responseBody ?? call.responseRawBody} />
        </div>
      </div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <details style={jsonBlockStyle}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>{label}</summary>
      <pre style={preStyle}>{formatJson(value)}</pre>
    </details>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}

function SummaryCard({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div style={summaryCard}>
      <div style={{ color: '#777', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 700, color: danger && value > 0 ? '#c62828' : '#222', marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 14, margin: '22px 0 10px' }}>{children}</h3>;
}

function StatusBadge({ success, status }: { success: boolean | null; status: number | null }) {
  const pending = success === null;
  const color = pending ? '#666' : success ? '#2e7d32' : '#c62828';
  const background = pending ? '#f0f0f0' : success ? '#e8f5e9' : '#fdecea';
  return (
    <span style={{ color, background, borderRadius: 10, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
      {status ?? '-'} {pending ? 'Pending' : success ? 'Success' : 'Error'}
    </span>
  );
}

function TypeBadge({ value }: { value: string | null }) {
  const full = value === 'FULL';
  return (
    <span style={{ color: full ? '#6a1b9a' : '#1565c0', background: full ? '#f3e5f5' : '#e3f2fd', borderRadius: 4, padding: '3px 7px', fontSize: 11, fontWeight: 700 }}>
      {value ?? 'UNKNOWN'}
    </span>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('es-MX');
}

function formatDuration(value: number | null): string {
  if (value === null) return '-';
  if (value < 1000) return value + ' ms';
  return (value / 1000).toFixed(2) + ' s';
}

function shortId(value: string): string {
  return value.length > 18 ? value.slice(0, 8) + '...' + value.slice(-6) : value;
}

function operationName(value: string): string {
  const names: Record<string, string> = {
    get_auth_token: 'Get Auth Token',
    refresh_auth_token: 'Refresh Auth Token',
    upload_grocery: 'Upload Grocery',
  };
  return names[value] ?? value;
}

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return 'No data';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function getErrorMessage(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string } }; message?: string };
  return candidate?.response?.data?.message ?? candidate?.message ?? 'Could not load inventory activity.';
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  marginBottom: 20,
};
const filterCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: 18,
  boxShadow: '0 1px 6px rgba(0,0,0,.06)',
  marginBottom: 16,
};
const filterGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
};
const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  marginBottom: 16,
};
const summaryCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  padding: '14px 18px',
  boxShadow: '0 1px 6px rgba(0,0,0,.06)',
};
const tableCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 1px 6px rgba(0,0,0,.06)',
  overflow: 'hidden',
};
const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#666',
  fontSize: 11,
  fontWeight: 600,
  marginBottom: 5,
};
const primaryButton: React.CSSProperties = {
  background: '#FF6B00',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 15px',
  fontSize: 13,
  fontWeight: 600,
};
const ghostButton: React.CSSProperties = {
  background: '#fff',
  color: '#333',
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: '8px 15px',
  fontSize: 13,
};
const smallButton: React.CSSProperties = {
  ...ghostButton,
  padding: '6px 11px',
  fontSize: 12,
};
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: '#777',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '11px 12px',
  verticalAlign: 'middle',
};
const secondaryText: React.CSSProperties = {
  color: '#888',
  fontSize: 11,
  marginTop: 3,
};
const codeStyle: React.CSSProperties = {
  background: '#f4f4f4',
  borderRadius: 4,
  padding: '2px 5px',
  fontSize: 11,
};
const storeBadge: React.CSSProperties = {
  background: '#f1f1f1',
  borderRadius: 8,
  padding: '2px 6px',
  fontSize: 11,
};
const emptyStyle: React.CSSProperties = {
  padding: 48,
  textAlign: 'center',
  color: '#888',
  fontSize: 14,
};
const paginationStyle: React.CSSProperties = {
  borderTop: '1px solid #eee',
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  background: 'rgba(0,0,0,.45)',
  padding: '24px 12px',
  overflowY: 'auto',
};
const modalStyle: React.CSSProperties = {
  background: '#fff',
  width: 'min(1050px, 100%)',
  margin: '0 auto',
  borderRadius: 12,
  boxShadow: '0 16px 60px rgba(0,0,0,.25)',
  overflow: 'hidden',
};
const modalHeaderStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: '#fff',
  borderBottom: '1px solid #e5e5e5',
  padding: '16px 20px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
};
const closeButton: React.CSSProperties = {
  background: '#f1f1f1',
  border: 'none',
  borderRadius: '50%',
  width: 30,
  height: 30,
  color: '#555',
  fontSize: 15,
};
const detailGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 14,
  background: '#fafafa',
  padding: 14,
  borderRadius: 8,
};
const jsonGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 8,
};
const jsonBlockStyle: React.CSSProperties = {
  border: '1px solid #e8e8e8',
  borderRadius: 7,
  padding: '9px 11px',
  minWidth: 0,
};
const preStyle: React.CSSProperties = {
  background: '#171717',
  color: '#e8e8e8',
  borderRadius: 6,
  padding: 11,
  marginTop: 8,
  maxHeight: 360,
  overflow: 'auto',
  fontSize: 11,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};
const callHeaderStyle: React.CSSProperties = {
  background: '#fafafa',
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
};
const sequenceBadge: React.CSSProperties = {
  background: '#333',
  color: '#fff',
  width: 21,
  height: 21,
  borderRadius: '50%',
  display: 'inline-flex',
  justifyContent: 'center',
  alignItems: 'center',
  fontSize: 11,
};
const errorBox: React.CSSProperties = {
  background: '#fef2f2',
  color: '#991b1b',
  border: '1px solid #fecaca',
  borderRadius: 7,
  padding: '9px 11px',
  fontSize: 12,
  marginTop: 12,
};
