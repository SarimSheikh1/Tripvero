import { t } from "../services/language";
import React, { useEffect, useState } from "react";
import { api, notifyError, uid } from "../services/api";
import { useAuth } from "../context/Auth";
import { Field, Button, Confirm } from "./UI";
import { Pencil, Trash2, MessageSquare } from "lucide-react";
export default function Comments({ tripId, target, targetType, canWrite }) {
  const { user } = useAuth(),
    [items, setItems] = useState([]),
    [text, setText] = useState(""),
    [edit, setEdit] = useState(null),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState(null);
  const load = () =>
    api
      .get(`/trips/${tripId}/comments`, { params: { target } })
      .then((r) => setItems(r.data))
      .catch(notifyError);
  useEffect(() => {
    load();
  }, [target]);
  return (
    <section className="comments">
      <h3>
        <MessageSquare size={16} />
        Comments
      </h3>
      {items.map((c) => (
        <article key={c._id}>
          <div>
            <b>{c.createdBy?.name}</b>
            <p>{c.text}</p>
          </div>
          {canWrite && uid(c.createdBy) === uid(user) && (
            <div>
              <button
                className="icon-btn"
                aria-label="Edit comment"
                onClick={() => {
                  setEdit(c);
                  setText(c.text);
                }}
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-btn"
                aria-label="Delete comment"
                onClick={() => setRemove(c)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </article>
      ))}
      {canWrite && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api[edit ? "patch" : "post"](
                `/trips/${tripId}/comments${edit ? `/${edit._id}` : ""}`,
                { text, target, targetType },
              );
              setText("");
              setEdit(null);
              load();
            } catch (e) {
              notifyError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label={edit ? "Edit comment" : "Add a comment"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            required
          />
          <Button busy={busy}>{edit ? "Save comment" : "Post comment"}</Button>
          {edit && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setEdit(null);
                setText("");
              }}
            >
              {t("Cancel")}
            </button>
          )}
        </form>
      )}
      {remove && (
        <Confirm
          message="Delete this comment?"
          onClose={() => setRemove(null)}
          onConfirm={async () => {
            try {
              await api.delete(`/trips/${tripId}/comments/${remove._id}`);
              load();
            } catch (e) {
              notifyError(e);
            }
          }}
        />
      )}
    </section>
  );
}
