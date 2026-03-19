import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Plus, ArrowLeft, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { GiftListCard } from "@/components/gifts/GiftListCard";
import { GiftItemCard } from "@/components/gifts/GiftItemCard";
import { CreateGiftListDialog } from "@/components/gifts/CreateGiftListDialog";
import { EditGiftListDialog } from "@/components/gifts/EditGiftListDialog";
import { AddGiftItemDialog } from "@/components/gifts/AddGiftItemDialog";
import { EditGiftItemDialog } from "@/components/gifts/EditGiftItemDialog";
import { useGiftLists, useGiftItems, type GiftItem, type GiftList } from "@/hooks/useGiftLists";
import { useChildren } from "@/hooks/useChildren";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const GiftsPage = () => {
  const { children } = useChildren();
  const { 
    giftLists, 
    loading, 
    isParent, 
    profileId,
    createGiftList, 
    updateGiftList,
    deleteGiftList 
  } = useGiftLists();
  
  const [selectedList, setSelectedList] = useState<GiftList | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [listToEdit, setListToEdit] = useState<GiftList | null>(null);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<GiftItem | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Gift items for selected list
  const {
    items,
    loading: itemsLoading,
    isParent: isParentForItems,
    profileId: profileIdForItems,
    addItem,
    updateItem,
    claimItem,
    unclaimItem,
    markPurchased,
    deleteItem,
  } = useGiftItems(selectedList?.id || "");

  const handleDeleteList = async () => {
    if (listToDelete) {
      await deleteGiftList(listToDelete);
      setListToDelete(null);
      if (selectedList?.id === listToDelete) {
        setSelectedList(null);
      }
    }
  };

  const handleDeleteItem = async () => {
    if (itemToDelete) {
      await deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedList && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedList(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2">
                  <Gift className="w-7 h-7 text-primary" />
                  {selectedList ? selectedList.child_name + "'s Gifts" : "Gift Lists"}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {selectedList 
                    ? "Coordinate gifts to avoid duplicates"
                    : "Organize and coordinate gifts for your children"}
                </p>
              </div>
            </div>
            {isParent && !selectedList && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Gift List
              </Button>
            )}
            {selectedList && isParent && (
              <Button onClick={() => setShowAddItemDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Gift
              </Button>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {!selectedList ? (
            // Gift Lists View
            <motion.div
              key="lists"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {giftLists.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No gift lists yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Create a gift list for birthdays, holidays, or other occasions to coordinate 
                    gifts and avoid duplicates.
                  </p>
                  {isParent && (
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Gift List
                    </Button>
                  )}
                </motion.div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {giftLists.map((list) => (
                    <GiftListCard
                      key={list.id}
                      list={list}
                      isParent={isParent}
                      onClick={() => setSelectedList(list)}
                      onEdit={() => {
                        setListToEdit(list);
                        setShowEditDialog(true);
                      }}
                      onDelete={() => setListToDelete(list.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            // Gift Items View
            <motion.div
              key="items"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {itemsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <LoadingSpinner />
                </div>
              ) : items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <Gift className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No gifts yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Add gift ideas to this list so family members can claim them.
                  </p>
                  {isParent && (
                    <Button onClick={() => setShowAddItemDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Gift
                    </Button>
                  )}
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <GiftItemCard
                      key={item.id}
                      item={item}
                      isParent={isParentForItems}
                      profileId={profileIdForItems}
                      allowMultipleClaims={selectedList?.allow_multiple_claims || false}
                      onClaim={() => claimItem(item.id)}
                      onUnclaim={() => unclaimItem(item.id)}
                      onMarkPurchased={(purchased) => markPurchased(item.id, purchased)}
                      onEdit={() => {
                        setItemToEdit(item);
                        setShowEditItemDialog(true);
                      }}
                      onDelete={() => setItemToDelete(item.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Gift List Dialog */}
      <CreateGiftListDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        children={children}
        onSubmit={createGiftList}
      />

      {/* Edit Gift List Dialog */}
      <EditGiftListDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        list={listToEdit}
        children={children}
        onSubmit={updateGiftList}
      />

      {/* Add Gift Item Dialog */}
      <AddGiftItemDialog
        open={showAddItemDialog}
        onOpenChange={setShowAddItemDialog}
        isParent={isParent}
        onSubmit={addItem}
      />

      {/* Edit Gift Item Dialog */}
      <EditGiftItemDialog
        open={showEditItemDialog}
        onOpenChange={setShowEditItemDialog}
        item={itemToEdit}
        isParent={isParent}
        onSubmit={updateItem}
      />

      {/* Delete List Confirmation */}
      <AlertDialog open={!!listToDelete} onOpenChange={() => setListToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gift List?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the gift list and all its items. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteList} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Gift?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the gift from the list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default GiftsPage;
