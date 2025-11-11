import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, Search, Loader2, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MercadoLivreCategorySelectorProps {
  onCategorySelect: (categoryId: string, categoryPath: string) => void;
  selectedCategoryId?: string;
}

interface Category {
  id: string;
  name: string;
}

interface CategoryDetails extends Category {
  children_categories?: Category[];
}

export function MercadoLivreCategorySelector({
  onCategorySelect,
  selectedCategoryId,
}: MercadoLivreCategorySelectorProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryPath, setCategoryPath] = useState<CategoryDetails[]>([]);
  const [selectedId, setSelectedId] = useState(selectedCategoryId || "");

  useEffect(() => {
    loadRootCategories();
  }, []);

  const loadRootCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://api.mercadolibre.com/sites/MLB/categories");
      if (!response.ok) throw new Error("Failed to load categories");
      
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as categorias do Mercado Livre",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryDetails = async (categoryId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.mercadolibre.com/categories/${categoryId}`);
      if (!response.ok) throw new Error("Failed to load category details");
      
      const data: CategoryDetails = await response.json();
      
      // Add to path
      setCategoryPath(prev => [...prev, data]);
      
      // If has children, show them
      if (data.children_categories && data.children_categories.length > 0) {
        setCategories(data.children_categories);
      } else {
        // Leaf category - select it
        handleSelectCategory(data.id, buildCategoryPathString([...categoryPath, data]));
      }
    } catch (error) {
      console.error("Error loading category details:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes da categoria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (category: Category) => {
    loadCategoryDetails(category.id);
  };

  const handleSelectCategory = (categoryId: string, pathString: string) => {
    setSelectedId(categoryId);
    onCategorySelect(categoryId, pathString);
    toast({
      title: "Categoria selecionada",
      description: pathString,
    });
  };

  const buildCategoryPathString = (path: CategoryDetails[]): string => {
    return path.map(c => c.name).join(" > ");
  };

  const goBack = () => {
    if (categoryPath.length === 0) return;
    
    const newPath = [...categoryPath];
    newPath.pop();
    setCategoryPath(newPath);
    
    if (newPath.length === 0) {
      loadRootCategories();
    } else {
      const parent = newPath[newPath.length - 1];
      if (parent.children_categories) {
        setCategories(parent.children_categories);
      }
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentPathString = buildCategoryPathString(categoryPath);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      {/* Breadcrumb */}
      {categoryPath.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">📂 {currentPathString}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar categoria..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories List */}
      <ScrollArea className="h-[300px] rounded-md border">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredCategories.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma categoria encontrada
              </p>
            ) : (
              filteredCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategoryClick(category)}
                  className={`w-full flex items-center justify-between p-3 rounded-md hover:bg-accent transition-colors ${
                    selectedId === category.id ? "bg-accent font-medium" : ""
                  }`}
                >
                  <span className="text-sm text-left">{category.name}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      {selectedId && (
        <p className="text-xs text-muted-foreground">
          ✅ Categoria selecionada: {selectedId}
        </p>
      )}
    </div>
  );
}
