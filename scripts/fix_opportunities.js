const fs = require('fs');

const file = 'app/(app)/opportunities/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Match everything from `{/* Bulk Actions Bar */}` to the end of the file
const regex = /\{\/\* Bulk Actions Bar \*\/\}[\s\S]*\}\s*<\/div>\s*\)\s*\}/m;

const replacement = `{/* Bulk Actions Bar */}
      {selectedStocks.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-popover/95 backdrop-blur-md border border-border/50 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-10 z-50">
          <div className="flex items-center text-sm font-medium">
            <Badge className="mr-3 h-6 rounded-full px-2 text-sm">{selectedStocks.size}</Badge>
            stocks selected
          </div>
          <div className="flex items-center gap-2 border-l border-border/50 pl-6">
            <Button size="sm" variant="ghost" className="gap-2">
              <Plus className="h-4 w-4" />
              Watchlist
            </Button>
            <Button size="sm" variant="ghost" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            
            <div className="w-px h-6 bg-border/50 mx-1" />
            
            <div className="relative">
              <Button 
                size="sm"
                variant={selectedStocks.size >= 2 && selectedStocks.size <= 4 ? "default" : "secondary"}
                disabled={selectedStocks.size < 2 || selectedStocks.size > 4}
                onClick={() => {
                  const tickers = Array.from(selectedStocks).join(",")
                  router.push(\`/compare?tickers=\${tickers}\`)
                }}
                className="gap-2"
              >
                <GitCompare className="h-4 w-4" />
                Compare
              </Button>
              {selectedStocks.size > 4 && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-xs px-3 py-1.5 rounded-md whitespace-nowrap shadow-md pointer-events-none after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-destructive">
                  Select 2-4 stocks
                </div>
              )}
            </div>

            <Button size="sm" variant="ghost" onClick={() => setSelectedStocks(new Set())} className="ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Successfully replaced target text using regex.");
} else {
    console.log("Error: Regex did not match target text in file. ");
}
