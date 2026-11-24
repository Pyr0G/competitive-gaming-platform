import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MessageCircle,
  Settings,
  ShieldBan,
  Swords,
  UserRound,
} from "lucide-react";
import type {
  GamingProfile,
  Player,
  PlayerResponse,
} from "../../../shared/contracts";
import { json, RequestError } from "../../lib/api";
import { useLocale } from "../../i18n";
import { useSession, useChat } from "../../app/contexts";
import { Avatar, Alert, useAction, Loading } from "../../components/ui";
import { GamingProfileDetails } from "./gaming";

export function ProfilePage() {
  const { id } = useParams();
  const { account, request } = useSession();
  const { t, date } = useLocale();
  const chat = useChat();
  const [player, setPlayer] = useState<Player | null>(null);
  const [gaming, setGaming] = useState<GamingProfile | null>(null);
  const [relationship, setRelationship] = useState<{
    blockedByMe: boolean;
    blockedByOther: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const action = useAction();
  useEffect(() => {
    const controller = new AbortController();
    request<PlayerResponse>(`/players/${encodeURIComponent(id || "")}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setPlayer(result.player);
          setGaming(result.gaming);
          setRelationship(result.relationship);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(failure instanceof RequestError ? failure.code : "generic");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, request]);
  if (loading) return <Loading />;
  if (!player)
    return (
      <div className="empty-state">
        <UserRound size={32} />
        <h1>{t("profile.notFound")}</h1>
        <Alert code={error} />
      </div>
    );
  const conversation = chat.conversations.find(
    (item) => item.player.id === player.id,
  );
  const blockedByMe =
    conversation?.blockedByMe ?? relationship?.blockedByMe ?? false;
  const blockedByOther =
    conversation?.blockedByOther ?? relationship?.blockedByOther ?? false;
  const isSelf = account?.id === player.id;
  return (
    <div className="page-container profile-page">
      <section className="panel public-profile">
        <div className="profile-cover">
          <span className="cover-line" />
          <span className="cover-symbol">
            <Swords size={120} strokeWidth={0.6} />
          </span>
        </div>
        <div className="public-profile-content">
          <div className="public-profile-header">
            <Avatar name={player.username} large />
            <div className="public-profile-name">
              <h1>{player.username}</h1>
              <p className="muted">
                {t("profile.joined", { date: date(player.createdAt) })}
              </p>
            </div>
            {isSelf ? (
              <Link to="/account" className="button button-secondary">
                <Settings size={17} />
                {t("profile.self")}
              </Link>
            ) : (
              <button
                className="button"
                disabled={
                  action.busy ||
                  conversation?.unavailable ||
                  blockedByMe ||
                  blockedByOther
                }
                onClick={() => void action.run(() => chat.start(player.id))}
              >
                <MessageCircle size={18} />
                {t("profile.message")}
              </button>
            )}
          </div>
          <Alert code={action.error} />
          <div className="profile-about">
            <h2>{t("profile.about")}</h2>
            <p className={player.bio ? "user-content" : "muted"}>
              {player.bio || t("profile.noBio")}
            </p>
          </div>
          {gaming && <GamingProfileDetails gaming={gaming} />}
          {!isSelf && account && (
            <div className="profile-controls">
              <button
                className="text-button"
                onClick={() =>
                  void action.run(
                    async () => {
                      await request(
                        `/blocks/${player.id}`,
                        json(blockedByMe ? "DELETE" : "PUT"),
                      );
                      setRelationship({
                        blockedByMe: !blockedByMe,
                        blockedByOther,
                      });
                      chat.refresh();
                    },
                    blockedByMe ? "profile.unblocked" : "profile.blocked",
                  )
                }
                disabled={action.busy}
              >
                <ShieldBan size={16} />
                {t(blockedByMe ? "profile.unblock" : "profile.block")}
              </button>
              <small>{t("profile.blockHelp")}</small>
            </div>
          )}
          <Alert success code={action.success} />
        </div>
      </section>
    </div>
  );
}
