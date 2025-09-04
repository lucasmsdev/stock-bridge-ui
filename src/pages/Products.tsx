import { useState } from "react";
import { Plus, Search, MoreHorizontal, Edit, ExternalLink, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const products = [
  {
    id: 1,
    name: "Camiseta Básica Preta",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=60&h=60&fit=crop&crop=center",
    sku: "TSHIRT-BLK-G",
    stock: 58,
    price: "R$ 39,90",
    channels: ["🛍️", "🛒", "📦"]
  },
  {
    id: 2,
    name: "Calça Jeans Masculina",
    image: "https://images.unsplash.com/photo-1542272454315-7ad85ba6c8f4?w=60&h=60&fit=crop&crop=center",
    sku: "JEANS-M-42",
    stock: 23,
    price: "R$ 89,90",
    channels: ["🛍️", "🛒"]
  },
  {
    id: 3,
    name: "Tênis Esportivo",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=60&h=60&fit=crop&crop=center",
    sku: "SHOES-SP-42",
    stock: 15,
    price: "R$ 159,90",
    channels: ["🛍️", "📦"]
  },
  {
    id: 4,
    name: "Vestido Floral",
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=60&h=60&fit=crop&crop=center",
    sku: "DRESS-FL-M",
    stock: 0,
    price: "R$ 79,90",
    channels: ["🛒"]
  },
  {
    id: 5,
    name: "Mochila Executiva",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=60&h=60&fit=crop&crop=center",
    sku: "BAG-EXE-BK",
    stock: 34,
    price: "R$ 129,90",
    channels: ["🛍️", "🛒", "📦"]
  }
];

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const [showEmptyState, setShowEmptyState] = useState(false);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleProductSelection = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleAllProducts = () => {
    setSelectedProducts(
      selectedProducts.length === filteredProducts.length 
        ? [] 
        : filteredProducts.map(p => p.id)
    );
  };

  // Empty state component
  const EmptyProductsState = () => (
    <Card className="shadow-soft">
      <CardContent className="pt-12 pb-12 text-center">
        <div className="max-w-md mx-auto">
          <Package className="mx-auto h-16 w-16 text-muted-foreground mb-6" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-muted-foreground mb-6">
            Você ainda não tem produtos em seu catálogo. Que tal importar do seu primeiro canal?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button className="bg-gradient-primary hover:bg-primary-hover">
              <Plus className="mr-2 h-4 w-4" />
              Importar Produtos
            </Button>
            <Button variant="outline">
              Ver Integrações
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meus Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seu catálogo centralizado de produtos
          </p>
        </div>
        <Button className="bg-gradient-primary hover:bg-primary-hover hover:shadow-primary transition-all duration-200">
          <Plus className="mr-2 h-4 w-4" />
          Importar Produtos
        </Button>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedProducts.length > 0 && (
        <Card className="shadow-soft bg-primary/5 border-primary/20 animate-slide-up">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-primary">
                  {selectedProducts.length} produto{selectedProducts.length > 1 ? 's' : ''} selecionado{selectedProducts.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="hover:bg-destructive hover:text-destructive-foreground">
                  Deletar Selecionados
                </Button>
                <Button variant="outline" size="sm">
                  Editar em Massa
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedProducts([])}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="shadow-soft">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar produtos ou SKU..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{filteredProducts.length} produtos encontrados</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table or Empty State */}
      {filteredProducts.length === 0 && searchTerm === "" ? (
        <EmptyProductsState />
      ) : (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhum produto encontrado para "{searchTerm}"
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onCheckedChange={toggleAllProducts}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Canais</TableHead>
                    <TableHead className="w-12">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover hover:scale-105 transition-transform"
                          />
                          <div>
                            <div className="font-medium">{product.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {product.sku}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.stock === 0 ? "destructive" : product.stock < 20 ? "secondary" : "default"}
                          className={product.stock === 0 ? "" : product.stock < 20 ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}
                        >
                          {product.stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.price}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {product.channels.map((channel, idx) => (
                            <span key={idx} className="text-lg hover:scale-110 transition-transform">
                              {channel}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="hover:bg-muted hover:scale-105 transition-all"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border border-border shadow-medium z-50">
                            <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="hover:bg-muted cursor-pointer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Ver no Canal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}