import React, { Suspense, useEffect, useState } from "react";

import { Block, BlockResult, Graph } from "@testy/shared";
import { Box, Button, Heading, Text } from "grommet";
import { Diagram } from "@testy/diagram";
import { Link, useParams } from "react-router-dom";
import { gql, useSubscription } from "@apollo/client";
import { graphql } from "@gqless/react";
import TimeAgo from "react-timeago";
import styled from "styled-components";

import { fetchQuery, query } from "../../graphql";
import { usePrevious } from "../../hooks";
import Logo from "../Logo";
import getDiagramBlocksState from "./getDiagramBlocksState";

const ProjectScreen: React.FC = () => {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [openedRun, setOpenedRun] = useState<number>(0);
  const [hoverBlock, setHoverBlock] = useState<string | null>(null);
  const [hoverPath, setHoverPath] = useState<string[]>([]);
  return (
    <Box direction="row" fill>
      <Box
        basis="1/3"
        flex={false}
        pad="medium"
        background="light-3"
        overflow={{ vertical: "auto" }}
      >
        <Logo />
        <Suspense fallback="Loading ...">
          <ProjectHeader orgSlug={orgSlug} projectSlug={projectSlug} />
          <ProjectHistory
            orgSlug={orgSlug}
            projectSlug={projectSlug}
            openedRun={openedRun}
            onOpenRun={(id, graph) => {
              setOpenedRun(id);
              setGraph(graph);
            }}
            onHoverPath={setHoverPath}
          />
        </Suspense>
      </Box>

      <Diagram
        blocks={graph?.blocks ?? []}
        edges={graph?.edges ?? []}
        hoverBlock={hoverBlock}
        path={hoverPath}
        setHoverBlock={setHoverBlock}
        selected={null}
        onSelectBlock={() => null}
      />
    </Box>
  );
};

interface SlugInput {
  orgSlug: string;
  projectSlug: string;
}

const ProjectHeader = graphql(({ projectSlug, orgSlug }: SlugInput) => {
  const project = query.project({
    where: {
      // @ts-ignore
      slug: { _eq: projectSlug },
      organization: {
        // @ts-ignore
        slug: {
          _eq: orgSlug,
        },
      },
    },
  })?.[0];
  const name = project.name;
  const id = project.id;
  return (
    <Box direction="row" align="center" justify="between" flex={false}>
      <Heading level={1}>Project {name}</Heading>
      <Button
        label="Run now"
        primary
        onClick={() => {
          if (!id) return;
          fetchQuery(
            // language=graphql
            `
mutation ($project_id: Int!, $run_by_user: Int!) {
  insert_run_one(object: {project_id: $project_id, run_by_user: $run_by_user}) {
    id
  }
}
            `,
            { project_id: id, run_by_user: 1 }
          );
        }}
      />
    </Box>
  );
});

interface ProjectHistoryProps extends SlugInput {
  openedRun: number | null;
  onOpenRun: (id: number, graph: Graph | null) => void;
  onHoverPath: (path: string[]) => void;
}

const ProjectHistory: React.FC<ProjectHistoryProps> = ({
  orgSlug,
  projectSlug,
  openedRun,
  onOpenRun,
  onHoverPath,
}) => {
  const { data, loading } = useSubscription(
    gql`
      subscription($projectSlug: String!, $orgSlug: String!) {
        project(
          where: {
            slug: { _eq: $projectSlug }
            organization: { slug: { _eq: $orgSlug } }
          }
        ) {
          id
          graph
          run_aggregate {
            aggregate {
              count
            }
          }
          run(order_by: { started_at: desc }) {
            id
            started_at
            graph
            paths(order_by: { id: asc }) {
              id
              edges
              blocks_count
              blocks_success
              blocks_failed
              blocks_blocked
              credits
            }
            paths_aggregate {
              aggregate {
                sum {
                  credits
                  blocks_blocked
                  blocks_count
                  blocks_failed
                  blocks_success
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: { orgSlug, projectSlug },
    }
  );
  const previousData = usePrevious(data);

  const project = data?.project?.[0];
  const previousProject = previousData?.project?.[0];

  // Update graph history when subscription update received
  useEffect(() => {
    const run = project?.run?.find((r: any) => r.id === openedRun);
    const previousRun = previousProject?.run?.find(
      (r: any) => r.id === openedRun
    );
    if (run && previousRun && run !== previousRun) {
      console.log("effect update run", run.id);
      onOpenRun(run.id, getDiagramBlocksState(run));
    }
  }, [onOpenRun, openedRun, previousProject?.run, project?.run]);

  const handleOpen = (run: any) => {
    onOpenRun(run.id, getDiagramBlocksState(run));
  };

  useEffect(() => {
    if (openedRun === 0 && previousProject?.graph !== project?.graph) {
      onOpenRun(0, JSON.parse(project.graph));
    }
  }, [onOpenRun, openedRun, previousProject?.graph, project?.graph]);

  if (loading) return <Text>Loading...</Text>;
  if (!project) return <Text>Not found</Text>;

  return (
    <Box flex={false} gap="xsmall">
      <Box
        background="light-1"
        pad="small"
        onClick={() => onOpenRun(0, JSON.parse(project.graph))}
        border={{ side: "left", size: "medium", color: "brand" }}
      >
        Actual blocks
      </Box>
      {project.run.map((run: any) => {
        const opened = run.id === openedRun;
        const sum = run?.paths_aggregate?.aggregate?.sum;
        return (
          <Box
            key={run.id}
            background="light-1"
            pad="small"
            onClick={() => handleOpen(run)}
            border={{
              side: "left",
              size: "medium",
              color: getStatus(
                sum.blocks_success,
                sum.blocks_failed,
                sum.blocks_count
              ),
            }}
          >
            <Box direction="row" justify="between">
              <Text>
                {Math.round((sum?.blocks_success / sum?.blocks_count) * 100)}% -{" "}
                {sum?.blocks_failed} fails
              </Text>
              <Text>
                {sum?.credits ?? 0} credits, <TimeAgo date={run.started_at} />
              </Text>
            </Box>
            <Text>
              {/*{sum?.blocks_count} blocks ({sum?.blocks_success} success,{" "}*/}
              {/*, {sum?.blocks_blocked} blocked),{" "}*/}
              {/*{sum?.credits} credits*/}
            </Text>
            {opened && <RunPaths run={run} onHoverPath={onHoverPath} />}
          </Box>
        );
      })}
    </Box>
  );
};

const RunPaths: React.FC<{
  run: any;
  onHoverPath: (path: string[]) => void;
}> = ({ run, onHoverPath }) => {
  const { orgSlug, projectSlug } = useParams<{
    orgSlug: string;
    projectSlug: string;
  }>();

  const blocks: Block[] = run.graph.blocks;
  const failingBlocks: (Block & BlockResult)[] = run.paths
    .flatMap((path: any) => {
      const edges = JSON.parse(path.edges);
      return (
        edges.find((result: BlockResult) => result?.status === "failed") || []
      );
    })
    .map((result: BlockResult) => ({
      ...result,
      ...blocks.find(b => b.id === result.id),
    }));
  return (
    <div>
      {failingBlocks.map(result => (
        <Text key={result.id} style={{ display: "block" }}>
          {result.command} {result?.parameter} {result?.selector} {result?.msg}
        </Text>
      ))}
      {run.paths.map((path: any) => (
        <Link
          key={path.id + "path"}
          to={`/${orgSlug}/${projectSlug}/${path.id}`}
        >
          <PathLine
            color={getStatus(
              path.blocks_success,
              path.blocks_failed,
              path.blocks_count
            )}
            onMouseEnter={() =>
              onHoverPath(
                JSON.parse(path.edges).map((result: BlockResult) => result.id)
              )
            }
          >
            path #{path.id} - {path?.blocks_count} blocks (
            {path?.blocks_success} success, {path?.blocks_failed} failed,{" "}
            {path?.blocks_blocked} blocked), {path?.credits} credits
          </PathLine>
        </Link>
      ))}
    </div>
  );
};

const PathLine = styled(Text)`
  display: block;
  &:hover {
    font-weight: bold;
  }
`;

const getStatus = (pass: number, fail: number, total: number) =>
  fail > 0 ? "status-error" : pass === total ? "status-ok" : "status-unknown";

export default ProjectScreen;
