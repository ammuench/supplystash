<script setup lang="ts">
import { Page, Navbar, List, ListItem, Block } from "konsta/vue";

const items = [
  { id: "1", title: "Paper Towels", count: 2, warning: 4 },
  { id: "2", title: "Dish Soap", count: 1, warning: 2 },
  { id: "3", title: "Coffee Beans", count: 3, warning: 1 },
  { id: "4", title: "Trash Bags", count: 0, warning: 5 },
  { id: "5", title: "Hand Soap", count: 6, warning: 2 },
];

const status = (item: { count: number; warning: number }) => {
  if (item.count === 0) return "Out";
  if (item.count <= item.warning) return "Low";
  return "OK";
};
</script>

<template>
  <Page>
    <Navbar title="Supply Stash" />
    <Block strong class="text-center"> Fake inventory — hardcoded for scaffolding. </Block>
    <List strong inset>
      <ListItem
        v-for="item in items"
        :key="item.id"
        :title="item.title"
        :after="`${item.count} · ${status(item)}`"
      />
    </List>
  </Page>
</template>
