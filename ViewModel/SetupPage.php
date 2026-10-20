<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\ViewModel;

use Hryvinskyi\DataLayerAdminUi\Api\ModuleScriptInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\MergedContributionsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupPageConfigInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Serialize\SerializerInterface;
use Magento\Framework\View\Element\Block\ArgumentInterface;

/**
 * What the setup wizard's template prints: the page configuration as JSON, the module tags that load the wizard, and
 * the two lines shown before it starts or when it cannot
 *
 * The configuration is opened at the scope the request names (`website`, `store`), as the configuration page links
 * it. The JSON has `<` and `>` escaped, so no value can end the script element it is printed in. The lines are the
 * wizard's own phrases, so the server-rendered text and the browser's read the same.
 */
class SetupPage implements ArgumentInterface
{
    /**
     * The wizard's entry module
     */
    public const ENTRY_FILE_ID = 'Hryvinskyi_DataLayerAdminUi::js/setup/wizard.js';

    /**
     * The phrase shown while the wizard loads
     */
    public const LOADING_PHRASE = 'wizard.loading';

    /**
     * The phrase shown when the wizard cannot start
     */
    public const FAILED_PHRASE = 'wizard.failed';

    /**
     * @param RequestInterface $request
     * @param SetupPageConfigInterface $pageConfig
     * @param MergedContributionsInterface $contributions
     * @param ModuleScriptInterface $moduleScript
     * @param SerializerInterface $json Writes JSON with `<`, `>`, `&`, `'` and `"` escaped
     */
    public function __construct(
        private readonly RequestInterface $request,
        private readonly SetupPageConfigInterface $pageConfig,
        private readonly MergedContributionsInterface $contributions,
        private readonly ModuleScriptInterface $moduleScript,
        private readonly SerializerInterface $json
    ) {
    }

    /**
     * Get the page configuration as JSON safe to print inside a script element
     *
     * @return string
     * @throws \LogicException When two contributions clash
     * @throws \InvalidArgumentException When a registered setting has no field on the configuration page, or the
     *     configuration cannot be written as JSON
     * @throws \Magento\Framework\Exception\LocalizedException When no form key can be made
     */
    public function getConfigJson(): string
    {
        $json = $this->json->serialize(
            $this->pageConfig->build($this->request->getParam('website'), $this->request->getParam('store'))
        );
        if (!is_string($json)) {
            throw new \InvalidArgumentException('The setup page configuration cannot be written as JSON.');
        }

        return $json;
    }

    /**
     * Get the tags that load the wizard: the import map of every contribution's modules, then the entry module
     *
     * @return string
     * @throws \LogicException When two contributions map one import name to two files
     * @throws \InvalidArgumentException When an import is not a module script's file id
     * @throws \Magento\Framework\Exception\LocalizedException When a module's file cannot be resolved
     */
    public function getScripts(): string
    {
        return $this->moduleScript->render(self::ENTRY_FILE_ID, $this->contributions->getImports());
    }

    /**
     * Get the line shown while the wizard loads, and to a browser that runs no script
     *
     * @return string Translated
     * @throws \LogicException When no contribution gives the phrase
     */
    public function getLoadingText(): string
    {
        return $this->contributions->getText(self::LOADING_PHRASE);
    }

    /**
     * Get the line shown when the wizard cannot start
     *
     * @return string Translated
     * @throws \LogicException When no contribution gives the phrase
     */
    public function getFailedText(): string
    {
        return $this->contributions->getText(self::FAILED_PHRASE);
    }
}
