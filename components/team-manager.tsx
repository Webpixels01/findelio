"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type {
  ManageableTeamRole,
  TeamMember,
  TeamOrganization,
} from "@/lib/directus-team";

type Confirmation =
  | { type: "member"; organizationId: string; id: string; label: string }
  | { type: "invitation"; organizationId: string; id: string; label: string };

type TeamManagerProps = {
  organizations: TeamOrganization[];
};

function memberName(member: TeamMember): string {
  return (
    [member.first_name, member.last_name].filter(Boolean).join(" ") ||
    member.email
  );
}

export default function TeamManager({ organizations }: TeamManagerProps) {
  const t = useTranslations("Team");
  const locale = useLocale();
  const router = useRouter();
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, ManageableTeamRole>>({});
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }),
    [locale],
  );

  function errorMessage(code: string): string {
    const knownCodes = new Set([
      "invalid_data",
      "unauthorized",
      "forbidden",
      "member_exists",
      "invitation_exists",
      "rate_limited",
      "too_many_invitations",
      "send_failed",
      "update_failed",
      "not_found",
    ]);
    return t(`errors.${knownCodes.has(code) ? code : "unknown"}`);
  }

  async function runAction(
    key: string,
    body: Record<string, unknown>,
    successKey: string,
  ): Promise<boolean> {
    setBusyKey(key);
    setMessage(null);

    try {
      const response = await fetch("/api/account/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: errorMessage(result.error ?? "") });
        return false;
      }

      setMessage({ type: "success", text: t(successKey) });
      router.refresh();
      return true;
    } catch {
      setMessage({ type: "error", text: t("errors.network") });
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function invite(
    event: FormEvent<HTMLFormElement>,
    organization: TeamOrganization,
  ) {
    event.preventDefault();
    const email = emails[organization.id]?.trim() ?? "";
    const role = roles[organization.id] ?? organization.invite_roles[0];
    if (!email || !role) return;

    const succeeded = await runAction(
      `invite:${organization.id}`,
      {
        action: "invite",
        organization_id: organization.id,
        email,
        role,
        locale,
      },
      "messages.invited",
    );

    if (succeeded) {
      setEmails((current) => ({ ...current, [organization.id]: "" }));
    }
  }

  async function changeRole(member: TeamMember, role: ManageableTeamRole) {
    await runAction(
      `role:${member.id}`,
      { action: "update_role", member_id: member.id, role },
      "messages.roleUpdated",
    );
  }

  async function confirmAction() {
    if (!confirmation) return;

    const isMember = confirmation.type === "member";
    const succeeded = await runAction(
      `${confirmation.type}:${confirmation.id}`,
      isMember
        ? { action: "remove_member", member_id: confirmation.id }
        : {
            action: "cancel_invitation",
            invitation_id: confirmation.id,
          },
      isMember ? "messages.memberRemoved" : "messages.invitationCancelled",
    );
    if (succeeded) setConfirmation(null);
  }

  if (organizations.length === 0) {
    return (
      <p className="mt-8 rounded-3xl border border-[var(--border)] bg-white p-6 text-[var(--muted)]">
        {t("empty")}
      </p>
    );
  }

  return (
    <>
      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          className={`mt-7 rounded-2xl border p-4 font-bold ${
            message.type === "error"
              ? "border-[#efb5b5] bg-[#fff4f4] text-[#941b1b]"
              : "border-[#bfe4ca] bg-[#eefaf2] text-[#135f30]"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-8 grid gap-8">
        {organizations.map((organization) => {
          const canInvite = organization.invite_roles.length > 0;
          const selectedRole =
            roles[organization.id] ?? organization.invite_roles[0] ?? "editor";

          return (
            <section
              key={organization.id}
              className="overflow-hidden rounded-3xl border border-[var(--border)] bg-white shadow-xl shadow-[#001734]/6"
            >
              <div className="border-b border-[var(--border)] bg-[#f7fbff] p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">{t("organization")}</p>
                    <h2 className="mt-2 text-2xl font-extrabold">
                      {organization.name}
                    </h2>
                  </div>
                  <span className="inline-flex min-h-8 items-center rounded-full bg-[#e9f3ff] px-3 py-1 text-sm font-extrabold text-[#005fbd]">
                    {t(`roles.${organization.current_role}`)}
                  </span>
                </div>
              </div>

              <div className="grid gap-8 p-6 sm:p-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.8fr)]">
                <div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-extrabold">
                        {t("membersTitle")}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {t("membersCount", { count: organization.members.length })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {organization.members.map((member) => (
                      <article
                        key={member.id}
                        className="rounded-2xl border border-[var(--border)] p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-extrabold">
                              {memberName(member)}
                            </p>
                            <p className="mt-1 truncate text-sm text-[var(--muted)]">
                              {member.email}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {member.can_change_role ? (
                              <label className="sr-only" htmlFor={`role-${member.id}`}>
                                {t("roleFor", { name: memberName(member) })}
                              </label>
                            ) : null}
                            {member.can_change_role ? (
                              <select
                                id={`role-${member.id}`}
                                className="field-control h-10 w-auto min-w-36 py-1.5"
                                value={member.role}
                                disabled={busyKey === `role:${member.id}`}
                                onChange={(event) =>
                                  changeRole(
                                    member,
                                    event.target.value as ManageableTeamRole,
                                  )
                                }
                              >
                                <option value="admin">{t("roles.admin")}</option>
                                <option value="editor">{t("roles.editor")}</option>
                              </select>
                            ) : (
                              <span className="inline-flex min-h-8 items-center rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-bold">
                                {t(`roles.${member.role}`)}
                              </span>
                            )}

                            {member.can_remove && (
                              <button
                                type="button"
                                className="danger-button h-10 px-3 text-sm"
                                onClick={() =>
                                  setConfirmation({
                                    type: "member",
                                    organizationId: organization.id,
                                    id: member.id,
                                    label: memberName(member),
                                  })
                                }
                              >
                                {t("remove")}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <aside className="rounded-2xl border border-[#b8daf8] bg-[#f1f8ff] p-5">
                  <h3 className="text-xl font-extrabold">{t("inviteTitle")}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {canInvite ? t("inviteDescription") : t("viewOnly")}
                  </p>

                  {canInvite && (
                    <form
                      className="mt-5 grid gap-4"
                      onSubmit={(event) => invite(event, organization)}
                    >
                      <label className="field-group">
                        <span className="field-label">{t("email")}</span>
                        <input
                          type="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          className="field-control bg-white"
                          value={emails[organization.id] ?? ""}
                          onChange={(event) =>
                            setEmails((current) => ({
                              ...current,
                              [organization.id]: event.target.value,
                            }))
                          }
                          disabled={busyKey === `invite:${organization.id}`}
                        />
                      </label>
                      <label className="field-group">
                        <span className="field-label">{t("role")}</span>
                        <select
                          className="field-control bg-white"
                          value={selectedRole}
                          onChange={(event) =>
                            setRoles((current) => ({
                              ...current,
                              [organization.id]: event.target
                                .value as ManageableTeamRole,
                            }))
                          }
                          disabled={busyKey === `invite:${organization.id}`}
                        >
                          {organization.invite_roles.map((role) => (
                            <option key={role} value={role}>
                              {t(`roles.${role}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="primary-button h-11 px-5 disabled:cursor-wait disabled:opacity-60"
                        disabled={busyKey === `invite:${organization.id}`}
                      >
                        {busyKey === `invite:${organization.id}`
                          ? t("inviting")
                          : t("invite")}
                      </button>
                    </form>
                  )}

                  <div className="mt-7 border-t border-[#cfe3f5] pt-5">
                    <h4 className="font-extrabold">{t("pendingTitle")}</h4>
                    {organization.invitations.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {t("pendingEmpty")}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {organization.invitations.map((invitation) => (
                          <article
                            key={invitation.id}
                            className="rounded-xl border border-[#cfe3f5] bg-white p-3"
                          >
                            <p className="break-all font-bold">
                              {invitation.email}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {t(`roles.${invitation.role}`)} · {t("expires", {
                                date: dateFormatter.format(
                                  new Date(invitation.expires_at),
                                ),
                              })}
                            </p>
                            {canInvite && (
                              <button
                                type="button"
                                className="danger-button mt-3 min-h-10 px-3 text-sm"
                                onClick={() =>
                                  setConfirmation({
                                    type: "invitation",
                                    organizationId: organization.id,
                                    id: invitation.id,
                                    label: invitation.email,
                                  })
                                }
                              >
                                {t("cancelInvitation")}
                              </button>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </section>
          );
        })}
      </div>

      {confirmation && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#001734]/65 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busyKey) {
              setConfirmation(null);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="team-confirmation-title"
            aria-describedby="team-confirmation-description"
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 id="team-confirmation-title" className="text-2xl font-extrabold">
              {t(
                confirmation.type === "member"
                  ? "confirmMemberTitle"
                  : "confirmInvitationTitle",
              )}
            </h2>
            <p
              id="team-confirmation-description"
              className="mt-3 leading-7 text-[var(--muted)]"
            >
              {t(
                confirmation.type === "member"
                  ? "confirmMemberDescription"
                  : "confirmInvitationDescription",
                { name: confirmation.label },
              )}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="secondary-button h-11 px-5"
                onClick={() => setConfirmation(null)}
                disabled={Boolean(busyKey)}
              >
                {t("keep")}
              </button>
              <button
                type="button"
                className="danger-button-solid h-11 px-5"
                onClick={confirmAction}
                disabled={Boolean(busyKey)}
              >
                {busyKey ? t("working") : t("confirm")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
