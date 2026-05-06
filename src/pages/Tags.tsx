import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

const groups = ["occasion","market","family","style","packaging"];

const Tags = () => {
  const [tags, setTags] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("occasion");

  const load = () => supabase.from("tags").select("*").order("group_name").then(({data}) => setTags(data ?? []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name) return;
    const { error } = await supabase.from("tags").insert({ name, group_name: group });
    if (error) return toast.error(error.message);
    setName(""); load();
  };
  const del = async (id: string) => { await supabase.from("tags").delete().eq("id", id); load(); };

  return (
    <>
      <PageHeader title="Tag Manager" subtitle="Flexible tagging by occasion, market, family, style, packaging." />

      <div className="card-elevated p-5 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1"><Label>Tag name</Label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g. Wedding" /></div>
        <div><Label>Group</Label>
          <select className="h-10 px-3 rounded-md border bg-background text-sm w-full" value={group} onChange={(e)=>setGroup(e.target.value)}>
            {groups.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <Button onClick={add}>Add tag</Button>
      </div>

      {groups.map(g => (
        <div key={g} className="mb-6">
          <h3 className="font-display text-xl capitalize mb-2">{g}</h3>
          <div className="flex flex-wrap gap-2">
            {tags.filter(t => t.group_name === g).map(t => (
              <span key={t.id} className="badge-soft bg-secondary text-secondary-foreground pr-1.5">
                {t.name}
                <button onClick={()=>del(t.id)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </>
  );
};

export default Tags;
