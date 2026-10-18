import { ActionForm } from "@/components/app/action-form";
import { TaxToggle } from "@/components/app/tax-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { adminDb, withTenant } from "@/db";
import { ITEM_KINDS, KIND_LABELS, type Capacities, type FieldDef, type ItemKind } from "@/lib/domain";
import { FIELD_PRESETS } from "@/lib/field-presets";
import { fromMinor } from "@/lib/money";
import { requirePermission } from "@/server/auth";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { connectConfigured } from "@/server/stripe";
import { appBaseUrl } from "@/server/base-url";
import { disconnectStripeAction, saveOnlineBookingAction } from "@/server/settings-actions";
import { addItemTypeAction, addLocationAction, addTaxAction, addVesselAction, saveGeneralAction, setItemFieldsAction, setPriceAction } from "@/server/settings-actions";
import { saveInquirySettingsAction } from "@/server/inquiry-actions";
import { mailConfigured } from "@/server/mail";
import { getTenantConfig } from "@/server/shared";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const sp = await searchParams;
  const auth = await requirePermission("settings.manage");
  const data = await withTenant(auth.tenantId, async (tx) => ({
    ports: await tx.location.findMany({ orderBy: { name: "asc" } }),
    boats: await tx.vessel.findMany({ orderBy: { name: "asc" } }),
    items: await tx.itemType.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prices: await tx.priceRule.findMany({ where: { active: true } }),
    taxes: await tx.taxRule.findMany({ orderBy: { name: "asc" } }),
    config: await getTenantConfig(tx),
  }));
  const cur = auth.tenant.baseCurrency;
  const slug = (await adminDb().tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { slug: true } })).slug;
  const base = await appBaseUrl();
  const bookingUrl = `${base}/book/${slug}`;
  const inquiryUrl = `${base}/inquire/${slug}`;
  const embedSnippet = `<iframe src="${inquiryUrl}" title="Request a quote" width="100%" height="900" style="border:0;max-width:640px"></iframe>`;
  const anyRoute = (id: string) => data.prices.find((p) => p.itemTypeId === id && !p.originId && !p.destinationId)?.unitPrice;

  return (
    <>
      <PageHeader title="Settings" description={`Prices are in ${cur}. Changes apply to new bookings only; existing bookings keep the price they were sold at.`} />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Details to ask for" description="Tick what staff must record when they sell each item. Weight and consignee also appear on the freight waybill." />
          <div className="divide-y divide-line">
            {data.items.map((t) => {
              const on = new Set((t.fieldSchema as FieldDef[]).map((f) => f.key));
              return (
                <div key={t.id} className="px-5 py-4">
                  <ActionForm action={setItemFieldsAction} reset={false} submitLabel="Save" className="flex flex-wrap items-center gap-x-5 gap-y-2 [&>button]:mt-0">
                    <input type="hidden" name="itemTypeId" value={t.id} />
                    <span className="w-40 font-medium">{t.name}</span>
                    {FIELD_PRESETS[t.kind as ItemKind].map((p) => (
                      <Checkbox key={p.key} name="fields" value={p.key} label={p.label} defaultChecked={on.has(p.key)} />
                    ))}
                  </ActionForm>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Prices" description="Standard price per item, on any route." />
          <Table>
            <thead><tr><Th>Item</Th><Th>Type</Th><Th>Space used</Th><Th>Price ({cur})</Th></tr></thead>
            <tbody>
              {data.items.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium">{t.name}</Td>
                  <Td><Badge>{KIND_LABELS[t.kind as ItemKind]}</Badge></Td>
                  <Td className="tabular text-muted">{t.capacityUnits}</Td>
                  <Td>
                    <ActionForm action={setPriceAction} reset={false} submitLabel="Save" className="flex flex-wrap items-center gap-2 [&>button]:mt-0">
                      <input type="hidden" name="itemTypeId" value={t.id} />
                      <Input name="price" aria-label={`Price for ${t.name}`} inputMode="decimal" className="h-8 w-28" defaultValue={fromMinor(anyRoute(t.id) ?? 0, cur)} />
                    </ActionForm>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <CardBody className="border-t border-line">
            <p className="mb-3 text-sm font-medium">Add an item to sell</p>
            <ActionForm action={addItemTypeAction} submitLabel="Add item">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Name" htmlFor="it-name"><Input id="it-name" name="name" placeholder="e.g. Container" required /></Field>
                <Field label="Type" htmlFor="it-kind"><Select id="it-kind" name="kind">{ITEM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</Select></Field>
                <Field label="Space used" htmlFor="it-units" hint="Capacity units"><Input id="it-units" name="units" type="number" min={1} defaultValue={1} /></Field>
                <Field label={`Price (${cur})`} htmlFor="it-price"><Input id="it-price" name="price" inputMode="decimal" placeholder="0.00" /></Field>
              </div>
            </ActionForm>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Ports" />
            <ul className="divide-y divide-line">{data.ports.map((p) => <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm"><span className="font-medium">{p.name}</span><Badge>{p.code}</Badge></li>)}</ul>
            <CardBody className="border-t border-line">
              <ActionForm action={addLocationAction} submitLabel="Add port">
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <Field label="Port name" htmlFor="p-name"><Input id="p-name" name="name" required /></Field>
                  <Field label="Code" htmlFor="p-code"><Input id="p-code" name="code" maxLength={6} className="uppercase" required /></Field>
                </div>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Vessels" />
            <ul className="divide-y divide-line">{data.boats.map((v) => <li key={v.id} className="px-5 py-3 text-sm"><p className="font-medium">{v.name}</p><p className="text-muted">{(v.capacities as Capacities).PASSENGER} passengers · {(v.capacities as Capacities).VEHICLE} vehicles · {(v.capacities as Capacities).CARGO} cargo</p></li>)}</ul>
            <CardBody className="border-t border-line">
              <ActionForm action={addVesselAction} submitLabel="Add vessel">
                <Field label="Vessel name" htmlFor="v-name" className="mb-3"><Input id="v-name" name="name" required /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Passengers" htmlFor="v-p"><Input id="v-p" name="passengers" type="number" min={0} defaultValue={0} /></Field>
                  <Field label="Vehicles" htmlFor="v-v"><Input id="v-v" name="vehicles" type="number" min={0} defaultValue={0} /></Field>
                  <Field label="Cargo" htmlFor="v-c"><Input id="v-c" name="cargo" type="number" min={0} defaultValue={0} /></Field>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Taxes" description="Inclusive tax is already inside your prices; exclusive tax is added on top." />
          {data.taxes.length > 0 && (
            <ul className="divide-y divide-line">
              {data.taxes.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span><span className="font-medium">{t.name}</span> <span className="text-muted">· {(t.rateBp / 100).toFixed(2)}% · {t.inclusive ? "included in price" : "added on top"} · {t.appliesTo === "ALL" ? "everything" : KIND_LABELS[t.appliesTo as ItemKind]}</span></span>
                  <span className="flex items-center gap-2"><Badge tone={t.active ? "ok" : "neutral"}>{t.active ? "On" : "Off"}</Badge><TaxToggle id={t.id} active={t.active} /></span>
                </li>
              ))}
            </ul>
          )}
          <CardBody className={data.taxes.length ? "border-t border-line" : undefined}>
            <ActionForm action={addTaxAction} submitLabel="Add tax">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Name" htmlFor="t-name"><Input id="t-name" name="name" placeholder="e.g. VAT" required /></Field>
                <Field label="Rate (%)" htmlFor="t-rate"><Input id="t-rate" name="rate" inputMode="decimal" placeholder="10" required /></Field>
                <Field label="Applies to" htmlFor="t-for"><Select id="t-for" name="appliesTo"><option value="ALL">Everything</option>{ITEM_KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]} only</option>)}</Select></Field>
              </div>
              <Checkbox className="mt-3" name="inclusive" label="Already included in my prices" />
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Offline sales" description="Agents without signal can sell a little past capacity; those sales are flagged for review." />
          <CardBody>
            <ActionForm action={saveGeneralAction} reset={false} submitLabel="Save">
              <Field label="Allowed oversell (%)" htmlFor="oversell" hint="Share of each vessel's space that offline sales may exceed. Beyond this, the sale goes to the review queue." className="max-w-xs">
                <Input id="oversell" name="oversell" type="number" min={0} max={50} step="any" defaultValue={data.config.oversellPercent} />
              </Field>
            </ActionForm>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Online booking" description="A public page where customers book and, if you connect Stripe, pay by card." />
          <CardBody className="space-y-4">
            {sp.connect === "ok" && <Alert tone="success">Stripe is connected. Card payments now go straight to your account.</Alert>}
            {sp.connect && sp.connect !== "ok" && <Alert tone="warning">Stripe wasn&apos;t connected ({sp.connect.replace("connect=", "")}). Try again.</Alert>}
            <ActionForm action={saveOnlineBookingAction} reset={false} submitLabel="Save" className="space-y-3">
              <Checkbox name="enabled" label="Let customers book online" defaultChecked={data.config.publicBookingEnabled} />
            </ActionForm>
            {data.config.publicBookingEnabled && <p className="text-sm">Your booking page: <a className="break-all font-medium text-brand-700 underline" href={bookingUrl}>{bookingUrl}</a></p>}
            <div className="border-t border-line pt-4 text-sm">
              {auth.tenant.stripeAccountId ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>Card payments: <strong>connected to your Stripe account</strong>.</span>
                  <form action={disconnectStripeAction}><Button type="submit" size="sm" variant="ghost">Disconnect</Button></form>
                </div>
              ) : connectConfigured() ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>Without Stripe, customers book online and pay at the ticket desk.</span>
                  <ButtonLink href="/api/stripe/connect/start" variant="secondary" size="sm">Connect Stripe</ButtonLink>
                </div>
              ) : (
                <p className="text-muted">Customers book online and pay at the ticket desk. Card payments need Stripe to be set up by your provider.</p>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Website inquiry form" description="A quote-request form you can put on your own website. Requests arrive under Inquiries." />
          <CardBody className="space-y-4">
            {!mailConfigured() && <Alert tone="warning">Email isn&apos;t set up on this server yet, so nobody will be emailed about new inquiries. They still appear under Inquiries.</Alert>}
            <ActionForm action={saveInquirySettingsAction} reset={false} submitLabel="Save" className="space-y-3">
              <Checkbox name="enabled" label="Turn the website form on" defaultChecked={data.config.inquiryEnabled} />
              <Field label="Email new inquiries to" htmlFor="inq-notify" hint="One or more addresses, separated by commas."><Input id="inq-notify" name="notify" defaultValue={data.config.inquiryNotify} placeholder="sales@yourcompany.com, ops@yourcompany.com" /></Field>
              <Field label="Message shown after sending" htmlFor="inq-thanks"><Textarea id="inq-thanks" name="thanks" rows={2} maxLength={500} defaultValue={data.config.inquiryThanks} /></Field>
            </ActionForm>
            {data.config.inquiryEnabled ? (
              <div className="space-y-2 border-t border-line pt-4 text-sm">
                <p>Your form: <a className="break-all font-medium text-brand-700 underline" href={inquiryUrl}>{inquiryUrl}</a></p>
                <p className="text-muted">To show it on your website, paste this where you want it to appear:</p>
                <pre className="overflow-x-auto rounded-lg bg-canvas p-3 text-xs"><code>{embedSnippet}</code></pre>
              </div>
            ) : (
              <p className="border-t border-line pt-4 text-sm text-muted">Turn the form on and save to get your link and the code to paste into your website.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
