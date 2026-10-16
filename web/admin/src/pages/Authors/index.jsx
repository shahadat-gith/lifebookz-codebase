import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../api/admin";
import Card, {
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/common/EmptyState";
import { Icons } from "../../icons";
import toast from "react-hot-toast";

/**
 * Authors — read-only list.
 *
 * There is no author approval pipeline: accounts become publishing authors
 * by completing the upgrade form in the author portal, so the admin panel
 * only ever lists them. (Expert applications still run through the Experts
 * screen.)
 */
export default function AuthorsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [authors, setAuthors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    loadData();
  }, [isAuthenticated, navigate]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await adminApi.getApprovedAuthors();
      setAuthors(res.data.data || []);
    } catch {
      toast.error("Failed to load authors");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" label="Loading authors..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <header className="mb-8 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Creators</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
          Authors
        </h1>
        <p className="text-sm text-muted-foreground">
          Everyone writing on the platform. Authors upgrade themselves by
          completing their profile — no approval needed.
        </p>
      </header>

      {/* Stats Bar */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <Card padding="md">
          <p className="font-display text-2xl font-extrabold text-success">
            {authors.length}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Authors</p>
        </Card>
        <Card padding="md">
          <p className="font-display text-2xl font-extrabold text-info">
            {authors.reduce((sum, a) => sum + (a.storyCount || 0), 0)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total Stories</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Authors</CardTitle>
          <CardDescription>
            {authors.length} publishing {authors.length === 1 ? "author" : "authors"}
          </CardDescription>
        </CardHeader>
        {authors.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon={<Icons.userCheck className="h-12 w-12" />}
              title="No authors yet"
              description="Authors appear here once they complete the upgrade form in the author portal."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {authors.map((author, idx) => (
              <motion.div
                key={author._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-sm font-bold text-success flex-shrink-0 overflow-hidden">
                    <img
                      src={author.avatar?.url || "/user.png"}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {author.fullName}
                      </p>
                      <Badge variant="success">Author</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {author.email}
                      {author.profession && <> • {author.profession}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {author.storyCount || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      stories
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
